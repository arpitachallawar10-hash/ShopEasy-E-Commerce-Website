
require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const MONGO_URI =
    process.env.MONGO_URI || "mongodb://127.0.0.1:27017/ecommerce";

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
    name: "store.sid",
    secret: process.env.SESSION_SECRET || "change-this-secret",
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: MONGO_URI }),
    cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 24 * 60 * 60 * 1000
    }
}));

app.use(express.static(path.join(__dirname, "public")));

const Product = mongoose.model("Product", new mongoose.Schema({
    name: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    description: String,
    image: String,
    stock: { type: Number, default: 20 }
}));

const User = mongoose.model("User", new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true }
}));

const Order = mongoose.model("Order", new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    items: [{
        productId: mongoose.Schema.Types.ObjectId,
        name: String,
        price: Number,
        quantity: Number
    }],
    total: Number,
    createdAt: { type: Date, default: Date.now }
}));

function requireLogin(req, res, next) {
    if (!req.session.userId) {
        return res.status(401).json({ message: "Please log in first." });
    }
    next();
}

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/api/products", async (req, res) => {
    try {
        res.json(await Product.find());
    } catch (error) {
        res.status(500).json({ message: "Unable to load products." });
    }
});

app.get("/api/products/:id", async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({ message: "Invalid product ID." });
        }

        const product = await Product.findById(req.params.id);

        if (!product) {
            return res.status(404).json({ message: "Product not found." });
        }

        res.json(product);
    } catch (error) {
        res.status(500).json({ message: "Unable to load product." });
    }
});

app.post("/api/register", async (req, res) => {
    try {
        const { name, email, password } = req.body;

        if (
            typeof name !== "string" ||
            typeof email !== "string" ||
            typeof password !== "string" ||
            name.trim().length < 2 ||
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
            password.length < 8
        ) {
            return res.status(400).json({
                message: "Enter a valid name and email, and a password of at least 8 characters."
            });
        }

        const normalizedEmail = email.trim().toLowerCase();
        const existing = await User.findOne({ email: normalizedEmail });

        if (existing) {
            return res.status(409).json({
                message: "Email already registered."
            });
        }

        const user = await User.create({
            name: name.trim(),
            email: normalizedEmail,
            passwordHash: await bcrypt.hash(password, 12)
        });

        req.session.userId = user._id.toString();
        res.status(201).json({ message: "Registration successful!" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Registration failed." });
    }
});

app.post("/api/login", async (req, res) => {
    try {
        const email = String(req.body.email || "").trim().toLowerCase();
        const password = String(req.body.password || "");
        const user = await User.findOne({ email });

        if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
            return res.status(401).json({
                message: "Invalid email or password."
            });
        }

        req.session.regenerate(error => {
            if (error) {
                return res.status(500).json({ message: "Login failed." });
            }

            req.session.userId = user._id.toString();
            res.json({ message: `Welcome, ${user.name}!` });
        });
    } catch (error) {
        res.status(500).json({ message: "Login failed." });
    }
});

app.post("/api/logout", (req, res) => {
    req.session.destroy(error => {
        if (error) {
            return res.status(500).json({ message: "Logout failed." });
        }

        res.clearCookie("store.sid");
        res.json({ message: "Logged out successfully." });
    });
});

app.post("/api/orders", requireLogin, async (req, res) => {
    try {
        if (!Array.isArray(req.body.items) ||
            req.body.items.length === 0 ||
            req.body.items.length > 30) {
            return res.status(400).json({ message: "Cart is empty or invalid." });
        }

        const items = [];
        let total = 0;

        for (const item of req.body.items) {
            if (
                !mongoose.isValidObjectId(item.productId) ||
                !Number.isInteger(item.quantity) ||
                item.quantity < 1 ||
                item.quantity > 20
            ) {
                return res.status(400).json({ message: "Invalid cart item." });
            }

            const product = await Product.findById(item.productId);

            if (!product || product.stock < item.quantity) {
                return res.status(400).json({
                    message: "Product unavailable or insufficient stock."
                });
            }

            items.push({
                productId: product._id,
                name: product.name,
                price: product.price,
                quantity: item.quantity
            });

            total += product.price * item.quantity;
        }

        const order = await Order.create({
            user: req.session.userId,
            items,
            total
        });

        res.status(201).json({
            message: "Order placed successfully!",
            orderId: order._id,
            total
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Unable to place order." });
    }
});

app.get("/api/orders/my", requireLogin, async (req, res) => {
    try {
        const orders = await Order.find({
            user: req.session.userId
        }).sort({ createdAt: -1 });

        res.json(orders);
    } catch (error) {
        res.status(500).json({ message: "Unable to load orders." });
    }
});

async function startServer() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log("MongoDB connected successfully!");

        if (await Product.countDocuments() === 0) {
            await Product.insertMany([
                {
                    name: "T-Shirt",
                    price: 499,
                    description: "Comfortable cotton T-shirt.",
                    image: "https://placehold.co/400x300?text=T-Shirt",
                    stock: 20
                },
                {
                    name: "Shoes",
                    price: 1499,
                    description: "Comfortable casual shoes.",
                    image: "https://placehold.co/400x300?text=Shoes",
                    stock: 15
                },
                {
                    name: "Backpack",
                    price: 899,
                    description: "A practical college backpack.",
                    image: "https://placehold.co/400x300?text=Backpack",
                    stock: 10
                }
            ]);
            console.log("Sample products added!");
        }

        app.listen(PORT, () => {
            console.log(`Server running at http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error("Server startup error:", error.message);
    }
}

startServer();

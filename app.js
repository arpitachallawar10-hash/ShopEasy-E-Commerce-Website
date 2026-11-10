async function api(url, options = {}) {
    const response = await fetch(url, {
        ...options,
        headers: {
            ...(options.headers || {}),
            ...(options.body ? { "Content-Type": "application/json" } : {})
        },
        credentials: "same-origin"
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(
            data.message || data.error || `Request failed: ${response.status}`
        );
    }

    return data;
}
function getCart() {
    try {
        const cart = JSON.parse(localStorage.getItem("shopCart"));
        return Array.isArray(cart) ? cart : [];
    } catch {
        return [];
    }
}

function saveCart(cart) {
    localStorage.setItem("shopCart", JSON.stringify(cart));
    updateCartCount();
}

function updateCartCount() {
    const countElement = document.getElementById("cart-count");

    if (!countElement) return;

    const total = getCart().reduce(
        (sum, item) => sum + Number(item.quantity || 1),
        0
    );

    countElement.textContent = total;
}

function addToCart(product) {
    if (!product || !(product._id || product.id)) {
        alert("Unable to add this product. Product ID is missing.");
        return;
    }

    const cart = getCart();
    const productId = String(product._id || product.id);

    const existingItem = cart.find(
        item => String(item._id || item.id) === productId
    );

    if (existingItem) {
        existingItem.quantity = Number(existingItem.quantity || 1) + 1;
    } else {
        cart.push({
            ...product,
            quantity: 1
        });
    }

    saveCart(cart);
    alert(`${product.name || "Product"} added to cart!`);
}

async function loadProducts() {
    const list = document.getElementById("products-list");

    if (!list) return;

    list.textContent = "Loading products...";

    try {
        const products = await api("/api/products");

        list.replaceChildren();

        if (!Array.isArray(products) || products.length === 0) {
            list.textContent = "No products available right now.";
            return;
        }

        products.forEach(product => {
            const card = document.createElement("article");
            card.className = "product-card";

            // Product image
            const image = document.createElement("img");

            image.src = product.image ||
                "https://placehold.co/400x280/ece7ff/6c4cff?text=Product";

            image.alt = product.name || "Product";

            image.onerror = function () {
                this.onerror = null;
                this.src =
                    "https://placehold.co/400x280/ece7ff/6c4cff?text=Product";
            };

            // Product name
            const name = document.createElement("h3");
            name.textContent = product.name || "Product";

            // Product description
            const description = document.createElement("p");
            description.textContent =
                product.description || "Discover this product.";

            // Product price
            const price = document.createElement("span");
            price.className = "price";

            price.textContent = "₹" +
                Number(product.price || 0).toLocaleString("en-IN", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                });
            const button = document.createElement("button");
            button.type = "button";
            button.textContent = "Add to Cart";

            button.addEventListener("click", () => {
                addToCart(product);
            });

            card.append(image, name, description, price, button);
            list.appendChild(card);
        });

    } catch (error) {
        console.error("Product loading error:", error);

        list.replaceChildren();

        const message = document.createElement("p");
        message.className = "loading-message";
        message.textContent =
            "Unable to load products. Please check your server.";

        list.appendChild(message);
    }
}
function setupRegistration() {
    const form = document.getElementById("register-form");

    if (!form) return;

    form.addEventListener("submit", async event => {
        event.preventDefault();

        const message = document.getElementById("message");
        const button = form.querySelector('button[type="submit"]');

        try {
            const name = form.querySelector("#name").value.trim();
            const email = form.querySelector("#email").value.trim();
            const password = form.querySelector("#password").value;

            if (!name || !email || !password) {
                throw new Error("Please fill in all fields.");
            }

            if (button) button.disabled = true;
            if (message) message.textContent = "Creating your account...";

            await api("/api/register", {
                method: "POST",
                body: JSON.stringify({ name, email, password })
            });

            if (message) {
                message.textContent =
                    "Registration successful! Redirecting to login...";
            }

            window.location.href = "login.html";

        } catch (error) {
            if (message) message.textContent = error.message;
            else alert(error.message);
        } finally {
            if (button) button.disabled = false;
        }
    });
}

function setupLogin() {
    const form = document.getElementById("login-form");

    if (!form) return;

    form.addEventListener("submit", async event => {
        event.preventDefault();

        const message = document.getElementById("message");
        const button = form.querySelector('button[type="submit"]');

        try {
            const email = form.querySelector("#email").value.trim();
            const password = form.querySelector("#password").value;

            if (!email || !password) {
                throw new Error("Please enter your email and password.");
            }

            if (button) button.disabled = true;
            if (message) message.textContent = "Logging in...";

            await api("/api/login", {
                method: "POST",
                body: JSON.stringify({ email, password })
            });

            // Redirect after successful login
            window.location.href = "dashboard.html";

        } catch (error) {
            if (message) message.textContent = error.message;
            else alert(error.message);
        } finally {
            if (button) button.disabled = false;
        }
    });
}

async function loadProductDetails() {
    const container = document.getElementById("product-detail");

    if (!container) return;

    const productId = new URLSearchParams(
        window.location.search
    ).get("id");

    if (!productId) {
        container.textContent = "Product not found.";
        return;
    }

    try {
        const product = await api(
            `/api/products/${encodeURIComponent(productId)}`
        );

        container.replaceChildren();

        const image = document.createElement("img");
        image.src = product.image ||
            "https://placehold.co/400x280/ece7ff/6c4cff?text=Product";
        image.alt = product.name || "Product";

        image.onerror = function () {
            this.onerror = null;
            this.src =
                "https://placehold.co/400x280/ece7ff/6c4cff?text=Product";
        };

        const name = document.createElement("h2");
        name.textContent = product.name || "Product";

        const description = document.createElement("p");
        description.textContent = product.description || "";

        const price = document.createElement("p");
        price.className = "price";
        price.textContent = "₹" + Number(product.price || 0).toFixed(2);

        const button = document.createElement("button");
        button.type = "button";
        button.textContent = "Add to Cart";
        button.addEventListener("click", () => addToCart(product));

        container.append(image, name, description, price, button);

    } catch (error) {
        console.error("Product details error:", error);
        container.textContent = "Unable to load product details.";
    }
}
function loadCartPage() {
    const container = document.getElementById("cart-items");
    const totalElement = document.getElementById("cart-total");

    if (!container || !totalElement) return;

    function renderCart() {
        const cart = getCart();

        container.replaceChildren();

        if (cart.length === 0) {
            container.textContent = "Your cart is empty.";
            totalElement.textContent = "0.00";
            return;
        }

        let total = 0;

        cart.forEach((item, index) => {
            const row = document.createElement("article");
            row.className = "product-card";

            const name = document.createElement("h3");
            name.textContent = item.name || "Product";

            const image = document.createElement("img");
            image.src = item.image ||
                "https://placehold.co/400x280/ece7ff/6c4cff?text=Product";
            image.alt = item.name || "Product";

            image.onerror = function () {
                this.onerror = null;
                this.src =
                    "https://placehold.co/400x280/ece7ff/6c4cff?text=Product";
            };

            const price = Number(item.price || 0);
            const quantity = Number(item.quantity || 1);
            const subtotal = price * quantity;

            total += subtotal;

            const details = document.createElement("p");
            details.textContent =
                `₹${price.toFixed(2)} × ${quantity} = ₹${subtotal.toFixed(2)}`;

            const removeButton = document.createElement("button");
            removeButton.type = "button";
            removeButton.textContent = "Remove";

            removeButton.addEventListener("click", () => {
                const updatedCart = getCart();
                updatedCart.splice(index, 1);
                saveCart(updatedCart);
                renderCart();
            });

            row.append(image, name, details, removeButton);
            container.appendChild(row);
        });

        totalElement.textContent = total.toFixed(2);
    }

    renderCart();
}
function setupCheckout() {
    const button = document.getElementById("checkout-button");

    if (!button) return;

    button.addEventListener("click", async () => {
        const message = document.getElementById("message");
        const cart = getCart();

        if (cart.length === 0) {
            if (message) message.textContent = "Your cart is empty.";
            else alert("Your cart is empty.");
            return;
        }

        try {
            button.disabled = true;

            if (message) message.textContent = "Placing your order...";

            await api("/api/orders", {
                method: "POST",
                body: JSON.stringify({
                    items: cart.map(item => ({
                        productId: item._id || item.id,
                        quantity: Number(item.quantity || 1)
                    }))
                })
            });

            localStorage.removeItem("shopCart");

            updateCartCount();
            loadCartPage();

            if (message) {
                message.textContent = "Order placed successfully!";
            } else {
                alert("Order placed successfully!");
            }

        } catch (error) {
            if (message) message.textContent = error.message;
            else alert(error.message);
        } finally {
            button.disabled = false;
        }
    });
}
function setupLogout() {
    const button = document.getElementById("logout-button");

    if (!button) return;

    button.addEventListener("click", async event => {
        event.preventDefault();

        try {
            await api("/api/logout", {
                method: "POST"
            });

            window.location.href = "login.html";

        } catch (error) {
            alert("Logout failed: " + error.message);
        }
    });
}
document.addEventListener("DOMContentLoaded", () => {
    updateCartCount();

    loadProducts();
    loadProductDetails();
    loadCartPage();

    setupRegistration();
    setupLogin();
    setupCheckout();
    setupLogout();
});
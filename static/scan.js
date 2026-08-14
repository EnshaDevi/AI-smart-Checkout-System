document.addEventListener('DOMContentLoaded', () => {
    // --- State ---
    let cart = [];
    let currentScannedProduct = null;
    let cameraStream = null;
    let scanningInterval = null;

    // --- DOM Elements ---
    // Scanner
    const liveCameraBtn = document.getElementById('liveCameraBtn');
    const uploadImageBtn = document.getElementById('uploadImageBtn');
    const fileUploadInput = document.getElementById('fileUploadInput');
    const scannerVideo = document.getElementById('scannerVideo');
    const uploadPreview = document.getElementById('uploadPreview');
    const scannerCanvas = document.getElementById('scannerCanvas');
    
    // Product Details
    const detailImg = document.getElementById('detailImg');
    const detailName = document.getElementById('detailName');
    const detailPrice = document.getElementById('detailPrice');
    const detailQty = document.getElementById('detailQty');
    const detailTotal = document.getElementById('detailTotal');
    const detailQtyMinus = document.getElementById('detailQtyMinus');
    const detailQtyPlus = document.getElementById('detailQtyPlus');
    const addToCartBtn = document.getElementById('addToCartBtn');

    // Cart
    const cartItemsContainer = document.getElementById('cartItemsContainer');
    const emptyCartMsg = document.getElementById('emptyCartMsg');
    const cartTotalItems = document.getElementById('cartTotalItems');
    const cartGrandTotal = document.getElementById('cartGrandTotal');

    // Footer DateTime
    document.getElementById('currentDate').textContent = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    document.getElementById('currentTime').textContent = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    // --- Scanner Logic ---
    async function startCamera() {
        stopCamera();
        uploadPreview.classList.add('hidden');
        scannerVideo.classList.remove('hidden');
        
        try {
            cameraStream = await navigator.mediaDevices.getUserMedia({ 
                video: { 
                    facingMode: 'environment',
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                } 
            });
            scannerVideo.srcObject = cameraStream;
            
            // Start scanning periodically
            scanningInterval = setInterval(scanFromVideo, 3000);
        } catch (err) {
            console.error('Error accessing camera:', err);
        }
    }

    function stopCamera() {
        if (cameraStream) {
            cameraStream.getTracks().forEach(track => track.stop());
            cameraStream = null;
        }
        if (scanningInterval) {
            clearInterval(scanningInterval);
            scanningInterval = null;
        }
    }

    function scanFromVideo() {
        if (!scannerVideo.videoWidth) return;
        
        const context = scannerCanvas.getContext('2d');
        scannerCanvas.width = scannerVideo.videoWidth;
        scannerCanvas.height = scannerVideo.videoHeight;
        context.drawImage(scannerVideo, 0, 0, scannerCanvas.width, scannerCanvas.height);
        
        const base64Img = scannerCanvas.toDataURL('image/jpeg');
        processBarcodeImage(base64Img);
    }

    // Toggle Input Modes
    liveCameraBtn.addEventListener('click', () => {
        liveCameraBtn.classList.add('active');
        uploadImageBtn.classList.remove('active');
        startCamera();
    });

    uploadImageBtn.addEventListener('click', () => {
        fileUploadInput.click();
    });

    fileUploadInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            uploadImageBtn.classList.add('active');
            liveCameraBtn.classList.remove('active');
            stopCamera();
            
            const reader = new FileReader();
            reader.onload = (ev) => {
                scannerVideo.classList.add('hidden');
                uploadPreview.classList.remove('hidden');
                uploadPreview.src = ev.target.result;
                processBarcodeImage(ev.target.result);
            };
            reader.readAsDataURL(file);
        }
    });

    // API Call to Python Backend
    async function processBarcodeImage(base64Img) {
        try {
            const response = await fetch('/api/scan_barcode', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image: base64Img })
            });
            const data = await response.json();
            
            if (data.success) {
                currentScannedProduct = data.product;
                currentScannedProduct.qty = 1;
                updateProductDetailsUI();
            } else {
                detailName.textContent = 'Scan failed: ' + (data.message || 'Product not found');
            }
        } catch (err) {
            console.error('API Error:', err);
            detailName.textContent = 'Network Error. Try again.';
        }
    }

    // --- Product Details Logic ---
    function updateProductDetailsUI() {
        if (!currentScannedProduct) return;
        
        // Handle absolute vs relative image URLs properly
        detailImg.src = currentScannedProduct.image ? (currentScannedProduct.image.startsWith('http') ? currentScannedProduct.image : `/static/${currentScannedProduct.image}`) : 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';
        detailName.textContent = currentScannedProduct.name;
        detailPrice.textContent = `₹${currentScannedProduct.price.toFixed(2)}`;
        detailQty.textContent = currentScannedProduct.qty;
        detailTotal.textContent = `₹${(currentScannedProduct.price * currentScannedProduct.qty).toFixed(2)}`;
        
        addToCartBtn.disabled = false;
    }

    detailQtyMinus.addEventListener('click', () => {
        if (currentScannedProduct && currentScannedProduct.qty > 1) {
            currentScannedProduct.qty--;
            updateProductDetailsUI();
        }
    });

    detailQtyPlus.addEventListener('click', () => {
        if (currentScannedProduct) {
            currentScannedProduct.qty++;
            updateProductDetailsUI();
        }
    });

    addToCartBtn.addEventListener('click', () => {
        if (!currentScannedProduct) return;
        
        // Check if already in cart
        const existingIndex = cart.findIndex(item => item.barcode === currentScannedProduct.barcode);
        
        if (existingIndex > -1) {
            cart[existingIndex].qty += currentScannedProduct.qty;
        } else {
            cart.push({ ...currentScannedProduct });
        }
        
        // Reset Scanner
        currentScannedProduct = null;
        detailName.textContent = 'Waiting for scan...';
        detailPrice.textContent = '₹0.00';
        detailQty.textContent = '1';
        detailTotal.textContent = '₹0.00';
        // Hide the image or use a base64 tiny placeholder to avoid broken image links
        detailImg.src = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs='; // Transparent 1x1 pixel
        addToCartBtn.disabled = true;
        
        renderCart();
        
        // Voice Feedback
        if ('speechSynthesis' in window) {
            window.speechSynthesis.speak(new SpeechSynthesisUtterance("Added to cart"));
        }
        
        // Automatically switch back to Live Camera mode after adding to cart
        if (!liveCameraBtn.classList.contains('active')) {
            liveCameraBtn.click();
        }
    });

    // --- Cart Logic ---
    function renderCart() {
        // Save to local storage for the receipt page
        localStorage.setItem('cart', JSON.stringify(cart));
        
        cartItemsContainer.innerHTML = '';
        
        if (cart.length === 0) {
            cartItemsContainer.appendChild(emptyCartMsg);
            emptyCartMsg.style.display = 'block';
            cartTotalItems.textContent = '0';
            cartGrandTotal.textContent = '₹0.00';
            return;
        }
        
        emptyCartMsg.style.display = 'none';
        
        let totalItems = 0;
        let grandTotal = 0;
        
        cart.forEach((item, index) => {
            totalItems += 1;
            const itemTotal = item.price * item.qty;
            grandTotal += itemTotal;
            
            const itemDiv = document.createElement('div');
            itemDiv.className = 'cart-item';
            itemDiv.innerHTML = `
                <div class="cart-item-info">
                    <img src="${item.image ? (item.image.startsWith('http') ? item.image : '/static/'+item.image) : 'https://via.placeholder.com/30'}" class="cart-item-img">
                    <span class="cart-item-name">${item.name}</span>
                </div>
                <div class="cart-item-price">₹${item.price.toFixed(2)}</div>
                <div class="cart-item-qty">
                    <div class="qty-selector">
                        <button class="qty-btn" onclick="updateCartQty(${index}, -1)"><i class="fa-solid fa-minus"></i></button>
                        <span class="qty-num">${item.qty}</span>
                        <button class="qty-btn" onclick="updateCartQty(${index}, 1)"><i class="fa-solid fa-plus"></i></button>
                    </div>
                </div>
                <div class="cart-item-total">₹${itemTotal.toFixed(2)}</div>
                <i class="fa-regular fa-trash-can cart-item-del" onclick="removeFromCart(${index})"></i>
            `;
            cartItemsContainer.appendChild(itemDiv);
        });
        
        cartTotalItems.textContent = totalItems;
        cartGrandTotal.textContent = `₹${grandTotal.toFixed(2)}`;
    }
    
    // Expose cart functions to global scope for inline onclick handlers
    window.updateCartQty = (index, delta) => {
        if (cart[index].qty + delta > 0) {
            cart[index].qty += delta;
            renderCart();
        }
    };
    
    window.removeFromCart = (index) => {
        cart.splice(index, 1);
        renderCart();
    };

    // Initialize Camera on load
    startCamera();
});

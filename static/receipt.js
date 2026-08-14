document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const verifyVideo = document.getElementById('verifyVideo');
    const verifyCanvas = document.getElementById('verifyCanvas');
    const capturedFace = document.getElementById('capturedFace');
    const facePanel = document.querySelector('.face-panel');

    // Status Elements
    const statusBox = document.getElementById('statusBox');
    const statusTitle = document.getElementById('statusTitle');
    const statusDesc = document.getElementById('statusDesc');
    const statusIcon = statusBox.querySelector('.status-icon');

    // Profile / Alert Boxes
    const userProfileBox = document.getElementById('userProfileBox');
    const fraudAlertBox = document.getElementById('fraudAlertBox');
    const fraudDataBox = document.getElementById('fraudDataBox');

    // Meta / Footers
    const successMeta = document.getElementById('successMeta');
    const failMeta = document.getElementById('failMeta');
    const successFooter = document.getElementById('successFooter');
    const failFooter = document.getElementById('failFooter');
    const blockedStamp = document.getElementById('blockedStamp');

    // Receipt Table
    const receiptTableBody = document.getElementById('receiptTableBody');
    const receiptTotalItems = document.getElementById('receiptTotalItems');
    const receiptSubTotal = document.getElementById('receiptSubTotal');
    const receiptTax = document.getElementById('receiptTax');
    const receiptGrandTotal = document.getElementById('receiptGrandTotal');
    const metaDate = document.getElementById('metaDate');
    const metaTime = document.getElementById('metaTime');
    const failTime = document.getElementById('failTime');

    let stream = null;

    // 1. Render Receipt from LocalStorage
    function renderReceipt() {
        const cart = JSON.parse(localStorage.getItem('cart') || '[]');

        let subTotal = 0;
        let totalItems = 0;
        receiptTableBody.innerHTML = '';

        cart.forEach((item, index) => {
            const itemTotal = item.price * item.qty;
            subTotal += itemTotal;
            totalItems += item.qty;

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${index + 1}</td>
                <td>${item.name}</td>
                <td>${item.price.toFixed(2)}</td>
                <td>${item.qty}</td>
                <td class="text-right">${itemTotal.toFixed(2)}</td>
            `;
            receiptTableBody.appendChild(tr);
        });

        const tax = subTotal * 0.05; // 5% tax
        const grandTotal = subTotal + tax;

        if (receiptTotalItems) receiptTotalItems.textContent = totalItems;
        if (receiptSubTotal) receiptSubTotal.textContent = subTotal.toFixed(2);
        if (receiptTax) receiptTax.textContent = tax.toFixed(2);
        if (receiptGrandTotal) receiptGrandTotal.textContent = `₹${grandTotal.toFixed(2)}`;
        
        const topGrandTotal = document.getElementById('topGrandTotal');
        if (topGrandTotal) topGrandTotal.textContent = `₹${grandTotal.toFixed(2)}`;

        // Set DateTime
        const now = new Date();
        const dateStr = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
        const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        metaDate.textContent = `: ${dateStr}`;
        metaTime.textContent = `: ${timeStr}`;
        failTime.textContent = `${dateStr} | ${timeStr}`;
    }

    // 2. Start Camera and Verify Face
    async function startVerification() {
        try {
            stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
            verifyVideo.srcObject = stream;

            // Wait 2 seconds for user to get ready, then capture
            setTimeout(captureAndVerify, 2000);

        } catch (err) {
            console.error("Camera access denied:", err);
            // Show fallback upload button instead of failing immediately
            document.getElementById('fallbackVerifyUpload').style.display = 'block';
            verifyVideo.style.display = 'none';
        }
    }

    // Handle the payload
    const currentCart = JSON.parse(localStorage.getItem('cart') || '[]');
    let currentSubTotal = 0;
    
    // Quick pass to calculate total for API
    currentCart.forEach(item => { currentSubTotal += item.price * item.qty; });
    const currentTax = currentSubTotal * 0.05;
    const finalGrandTotal = currentSubTotal + currentTax;

    // Fallback Upload Logic
    const verifyUploadBtn = document.getElementById('verifyUploadBtn');
    const verifyImageUpload = document.getElementById('verifyImageUpload');
    if (verifyUploadBtn) {
        verifyUploadBtn.addEventListener('click', () => {
            verifyImageUpload.click();
        });
        
        verifyImageUpload.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = async (event) => {
                    const base64Img = event.target.result;
                    
                    document.getElementById('fallbackVerifyUpload').style.display = 'none';
                    
                    capturedFace.src = base64Img;
                    capturedFace.style.display = 'block';
                    capturedFace.style.width = '100%';
                    capturedFace.style.height = '100%';
                    capturedFace.style.objectFit = 'cover';
                    capturedFace.style.borderRadius = '12px';
                    
                    try {
                        const res = await fetch('/api/verify_face', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ 
                                image: base64Img,
                                cart: currentCart,
                                totalAmount: finalGrandTotal
                            })
                        });
                        const data = await res.json();
                        handleVerificationResult(data);
                    } catch (err) {
                        handleVerificationResult({ success: false });
                    }
                };
                reader.readAsDataURL(file);
            }
        });
    }

    async function captureAndVerify() {
        const context = verifyCanvas.getContext('2d');
        verifyCanvas.width = verifyVideo.videoWidth;
        verifyCanvas.height = verifyVideo.videoHeight;
        context.drawImage(verifyVideo, 0, 0, verifyCanvas.width, verifyCanvas.height);

        const base64Img = verifyCanvas.toDataURL('image/jpeg');

        // Stop Camera feed
        stream.getTracks().forEach(track => track.stop());
        verifyVideo.style.display = 'none';

        // Show captured image in the UI
        capturedFace.src = base64Img;
        capturedFace.style.display = 'block';
        capturedFace.style.width = '100%';
        capturedFace.style.height = '100%';
        capturedFace.style.objectFit = 'cover';
        capturedFace.style.borderRadius = '12px';

        // Call Backend API
        try {
            const res = await fetch('/api/verify_face', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    image: base64Img,
                    cart: currentCart,
                    totalAmount: finalGrandTotal
                })
            });
            const data = await res.json();

            handleVerificationResult(data);

        } catch (err) {
            console.error("Verification error:", err);
            handleVerificationResult({ success: false });
        }
    }

    function handleVerificationResult(data) {
        const isSuccess = data.success;
        // Update Status Box
        statusBox.className = 'status-box';
        statusBox.classList.add(isSuccess ? 'success' : 'failed');

        const actionBtns = document.getElementById('receiptActionButtons');
        if (actionBtns) actionBtns.style.display = 'flex'; // Always show action buttons after scan

        if (isSuccess) {
            statusIcon.className = 'ph ph-check-circle status-icon';
            statusTitle.textContent = 'MATCH SUCCESSFUL';
            statusDesc.textContent = 'Face matched with registered profile.';

            // Dynamically set user info if available
            if (data.user) {
                // Update User Profile Box
                const profName = document.getElementById('profName');
                const profEmail = document.getElementById('profEmail');
                if (profName) profName.textContent = `: ${data.user.name}`;
                if (profEmail) profEmail.textContent = `: ${data.user.email}`;

                const profileAvatar = document.getElementById('profileAvatar');
                if(profileAvatar) {
                    profileAvatar.src = capturedFace.src; // Set the verified face as the profile avatar
                }

                // Update top navbar
                const navUserName = document.querySelector('.user-name');
                if (navUserName) navUserName.textContent = `Hi, ${data.user.name}`;
            }

            // Show Success UI
            facePanel.classList.add('success');
            document.getElementById('receiptPanel').style.display = 'block'; // Show Receipt ONLY on success
            successMeta.style.display = 'block';
            successFooter.style.display = 'flex';
            
            // Show UPI QR Code
            const qrContainer = document.getElementById('qrCodeContainer');
            const upiQRCode = document.getElementById('upiQRCode');
            if (qrContainer && upiQRCode) {
                upiQRCode.src = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=upi://pay?pa=store@upi&pn=SmartCheckout&am=${finalGrandTotal.toFixed(2)}`;
                qrContainer.style.display = 'block';
            }
            
            // Voice Feedback
            if ('speechSynthesis' in window) {
                window.speechSynthesis.speak(new SpeechSynthesisUtterance("Payment Successful. Thank you for shopping!"));
            }

        } else {
            statusIcon.className = 'ph ph-warning status-icon';
            statusTitle.textContent = 'MATCH FAILED';
            statusDesc.textContent = data.message || 'Face does not match with registered profile.';

            // Show Fraud UI
            facePanel.classList.add('failed');
            fraudAlertBox.style.display = 'flex';
            fraudDataBox.style.display = 'block';
            failMeta.style.display = 'flex';
            failFooter.style.display = 'flex';

            // Voice Feedback
            if ('speechSynthesis' in window) {
                window.speechSynthesis.speak(new SpeechSynthesisUtterance("Fraud Alert! Verification Failed."));
            }
        }
    }

    // Initialize
    renderReceipt();
    startVerification();
});

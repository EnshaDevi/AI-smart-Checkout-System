document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const form = document.getElementById('registration-form');
    const fullNameInput = document.getElementById('fullName');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const nextToCameraBtn = document.getElementById('nextToCameraBtn');
    
    // Camera & Canvas Elements
    const video = document.getElementById('webcam');
    const canvas = document.getElementById('snapshot');
    const cameraContainer = document.getElementById('cameraContainer');
    const previewContainer = document.getElementById('previewContainer');
    const captureStatusText = document.getElementById('captureStatusText');
    
    // Buttons
    const captureBtn = document.getElementById('captureBtn');
    const afterCaptureActions = document.getElementById('afterCaptureActions');
    const retakeBtn = document.getElementById('retakeBtn');
    const saveRegisterBtn = document.getElementById('saveRegisterBtn');
    
    // Modal Elements
    const modal = document.getElementById('successModal');
    const closeModal = document.getElementById('closeModal');
    const successMessage = document.getElementById('successMessage');

    let currentStream = null;
    let isCameraActive = false;
    let capturedFaceData = null;

    // Toggle Password Visibility
    const togglePasswordBtns = document.querySelectorAll('.toggle-password');
    togglePasswordBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
            if (passwordInput.type === 'password') {
                passwordInput.type = 'text';
                btn.classList.remove('ph-eye-closed');
                btn.classList.add('ph-eye');
            } else {
                passwordInput.type = 'password';
                btn.classList.remove('ph-eye');
                btn.classList.add('ph-eye-closed');
            }
        });
    });

    // Start Live Camera
    async function startCamera() {
        if (isCameraActive) return;
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: 320, height: 320, facingMode: "user" }
            });
            currentStream = stream;
            video.srcObject = stream;
            isCameraActive = true;
            captureStatusText.textContent = "Ready to capture";
            document.querySelector('.live-indicator').style.display = 'flex';
        } catch (err) {
            console.error("Camera error:", err);
            captureStatusText.textContent = "Camera access blocked";
            captureStatusText.style.color = "red";
            captureBtn.disabled = true;
            document.querySelector('.live-indicator').style.display = 'none';
        }
    }

    function stopCamera() {
        if (currentStream) {
            currentStream.getTracks().forEach(track => track.stop());
            currentStream = null;
            isCameraActive = false;
        }
    }

    // Initialize camera text
    captureStatusText.textContent = "Click 'Proceed to Face Scan' on the left to start camera";
    
    // Proceed button validation (optional step)
    if (nextToCameraBtn) {
        nextToCameraBtn.addEventListener('click', () => {
            if (!fullNameInput.value || !emailInput.value || !passwordInput.value) {
                alert("Please fill in your details first.");
                return;
            }
            // Start the camera only when details are filled and button is clicked
            startCamera();
            
            // Add a visual cue to look at the camera
            document.querySelector('.camera-panel').scrollIntoView({ behavior: 'smooth' });
            captureStatusText.textContent = "Please look at the camera and capture";
            captureStatusText.style.color = "var(--primary-teal)";
        });
    }

    // Capture Face Button Click
    captureBtn.addEventListener('click', () => {
        if (!isCameraActive) return;

        const context = canvas.getContext('2d');
        canvas.width = video.videoWidth || 320;
        canvas.height = video.videoHeight || 320;
        
        // Draw video frame to canvas
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        capturedFaceData = canvas.toDataURL('image/jpeg');

        // Switch to preview mode
        cameraContainer.classList.add('hidden');
        previewContainer.classList.remove('hidden');
        
        captureBtn.classList.add('hidden');
        afterCaptureActions.classList.remove('hidden');
        
        document.querySelector('.live-indicator').style.display = 'none';
        captureStatusText.textContent = 'Face captured!';
        captureStatusText.style.color = 'var(--primary-teal)';
    });

    // Retake Button Click
    retakeBtn.addEventListener('click', () => {
        capturedFaceData = null;
        
        cameraContainer.classList.remove('hidden');
        previewContainer.classList.add('hidden');
        
        captureBtn.classList.remove('hidden');
        afterCaptureActions.classList.add('hidden');
        
        document.querySelector('.live-indicator').style.display = 'flex';
        captureStatusText.textContent = 'Capture Photo';
        captureStatusText.style.color = 'var(--text-secondary)';
    });

    // FINAL STEP: Save & Register Both Details
    saveRegisterBtn.addEventListener('click', async () => {
        const pwd = passwordInput.value;
        const name = fullNameInput.value;
        const email = emailInput.value;

        if (!name || !email || !pwd) {
            alert("Please fill in your Username, Email, and Password on the left panel before completing login.");
            return;
        }
        if (!capturedFaceData) {
            alert("Please capture your face photo first.");
            return;
        }

        saveRegisterBtn.disabled = true;
        saveRegisterBtn.innerHTML = 'Logging in...';
        
        const capturedFormData = {
            fullName: name,
            email: email,
            password: pwd,
            faceImage: capturedFaceData
        };

        try {
            // Send both form data and face image to Python backend
            const response = await fetch('/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(capturedFormData)
            });
            
            const result = await response.json();
            
            if (result.success) {
                stopCamera();
                successMessage.textContent = result.message;
                modal.classList.remove('hidden');
            } else {
                alert("Error: " + result.message);
                saveRegisterBtn.disabled = false;
                saveRegisterBtn.innerHTML = 'Login & Complete';
            }
        } catch (error) {
            console.error('Error:', error);
            alert("Failed to connect to the server.");
            saveRegisterBtn.disabled = false;
            saveRegisterBtn.innerHTML = 'Login & Complete';
        }
    });

    // Close Modal and Proceed to Scan
    closeModal.addEventListener('click', () => {
        window.location.href = '/scan'; // Changed from /dashboard to /scan
    });
});

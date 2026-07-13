document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const formCard = document.getElementById('formCard');
    const cameraCard = document.getElementById('cameraCard');
    const form = document.getElementById('registration-form');
    
    // Camera & Canvas Elements
    const video = document.getElementById('webcam');
    const canvas = document.getElementById('snapshot');
    const cameraStatus = document.getElementById('cameraStatus');
    const cameraContainer = document.getElementById('cameraContainer');
    const previewContainer = document.getElementById('previewContainer');
    
    // Buttons
    const captureBtn = document.getElementById('captureBtn');
    const retakeBtn = document.getElementById('retakeBtn');
    const saveRegisterBtn = document.getElementById('saveRegisterBtn');
    const backToFormBtn = document.getElementById('backToForm');
    
    // Modal Elements
    const modal = document.getElementById('successModal');
    const closeModal = document.getElementById('closeModal');
    const successMessage = document.getElementById('successMessage');

    // Data Storage
    let capturedFormData = {};
    let currentStream = null;

    // Toggle Password Visibility
    const passwordFields = document.querySelectorAll('input[type="password"]');
    const togglePasswordBtns = document.querySelectorAll('.toggle-password');
    
    togglePasswordBtns.forEach((btn, index) => {
        btn.addEventListener('click', () => {
            const field = passwordFields[index];
            if (field.type === 'password') {
                field.type = 'text';
                btn.classList.remove('fa-eye');
                btn.classList.add('fa-eye-slash');
            } else {
                field.type = 'password';
                btn.classList.remove('fa-eye-slash');
                btn.classList.add('fa-eye');
            }
        });
    });

    // STEP 1: Form Submit (Move to Step 2)
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const pwd = document.getElementById('password').value;
        const confirmPwd = document.getElementById('confirmPassword').value;
        
        if (pwd !== confirmPwd) {
            alert("Passwords do not match!");
            return;
        }

        capturedFormData = {
            fullName: document.getElementById('fullName').value,
            email: document.getElementById('email').value,
            password: pwd
        };

        // Switch UI to Camera Step
        formCard.classList.add('hidden');
        cameraCard.classList.remove('hidden');
        resetCameraUI();
        startCamera();
    });

    // STEP 2: Initialize Live Camera
    async function startCamera() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: 400, height: 300, facingMode: "user" }
            });
            currentStream = stream;
            video.srcObject = stream;
            
            video.onloadedmetadata = () => {
                cameraStatus.textContent = 'Live Camera: Ready to capture your face.';
                cameraStatus.style.color = 'var(--text-light)';
            };
        } catch (err) {
            console.error("Camera error:", err);
            cameraStatus.textContent = 'Camera blocked. You can upload a photo instead.';
            cameraStatus.style.color = 'red';
            captureBtn.disabled = true;
            document.getElementById('fallbackUpload').classList.remove('hidden');
        }
    }

    function stopCamera() {
        if (currentStream) {
            currentStream.getTracks().forEach(track => track.stop());
            currentStream = null;
        }
    }

    // Capture Face Button Click
    captureBtn.addEventListener('click', () => {
        const context = canvas.getContext('2d');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        // Draw video frame to canvas
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Switch to preview mode
        cameraContainer.classList.add('hidden');
        previewContainer.classList.remove('hidden');
        
        captureBtn.classList.add('hidden');
        retakeBtn.classList.remove('hidden');
        saveRegisterBtn.classList.remove('hidden');
        
        cameraStatus.textContent = 'Face captured! You can now Save & Register.';
        cameraStatus.style.color = 'var(--primary-green)';
    });

    // Retake Button Click
    retakeBtn.addEventListener('click', () => {
        resetCameraUI();
    });

    // Reset Camera UI Helper
    function resetCameraUI() {
        cameraContainer.classList.remove('hidden');
        previewContainer.classList.add('hidden');
        
        captureBtn.classList.remove('hidden');
        captureBtn.disabled = false;
        retakeBtn.classList.add('hidden');
        saveRegisterBtn.classList.add('hidden');
        
        cameraStatus.textContent = 'Live Camera: Ready to capture your face.';
        cameraStatus.style.color = 'var(--text-light)';
    }

    // Fallback Upload Handling
    const uploadBtn = document.getElementById('uploadBtn');
    const imageUpload = document.getElementById('imageUpload');
    if (uploadBtn) {
        uploadBtn.addEventListener('click', () => {
            imageUpload.click();
        });
        
        imageUpload.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    const img = new Image();
                    img.onload = () => {
                        const context = canvas.getContext('2d');
                        canvas.width = 400;
                        canvas.height = 300;
                        context.drawImage(img, 0, 0, canvas.width, canvas.height);
                        
                        cameraContainer.classList.add('hidden');
                        previewContainer.classList.remove('hidden');
                        captureBtn.classList.add('hidden');
                        retakeBtn.classList.remove('hidden');
                        saveRegisterBtn.classList.remove('hidden');
                        
                        cameraStatus.textContent = 'Photo uploaded! You can now Save & Register.';
                        cameraStatus.style.color = 'var(--primary-green)';
                    };
                    img.src = event.target.result;
                };
                reader.readAsDataURL(file);
            }
        });
    }

    // FINAL STEP: Save & Register Both Details
    saveRegisterBtn.addEventListener('click', async () => {
        saveRegisterBtn.disabled = true;
        saveRegisterBtn.innerHTML = 'Saving...';
        
        // Get image data from canvas
        const imageData = canvas.toDataURL('image/jpeg');
        capturedFormData.faceImage = imageData;

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
                saveRegisterBtn.innerHTML = 'Save & Register';
            }
        } catch (error) {
            console.error('Error:', error);
            alert("Failed to connect to the server.");
            saveRegisterBtn.disabled = false;
            saveRegisterBtn.innerHTML = 'Save & Register';
        }
    });

    // Back to Form Click
    backToFormBtn.addEventListener('click', () => {
        stopCamera();
        cameraCard.classList.add('hidden');
        formCard.classList.remove('hidden');
    });

    // Close Modal and Proceed to Dashboard
    closeModal.addEventListener('click', () => {
        window.location.href = '/dashboard';
    });
});

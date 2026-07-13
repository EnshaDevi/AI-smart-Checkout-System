document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const loginCard = document.getElementById('loginCard');
    const cameraCard = document.getElementById('cameraCard');
    const form = document.getElementById('login-form');
    const faceLoginBtn = document.getElementById('faceLoginBtn');
    
    // Camera & Canvas Elements
    const video = document.getElementById('webcam');
    const canvas = document.getElementById('snapshot');
    const cameraStatus = document.getElementById('cameraStatus');
    const cameraContainer = document.getElementById('cameraContainer');
    const previewContainer = document.getElementById('previewContainer');
    
    // Buttons
    const captureBtn = document.getElementById('captureBtn');
    const retakeBtn = document.getElementById('retakeBtn');
    const verifyFaceBtn = document.getElementById('verifyFaceBtn');
    const backToFormBtn = document.getElementById('backToForm');
    
    // Modal Elements
    const modal = document.getElementById('successModal');
    const closeModal = document.getElementById('closeModal');

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

    // Standard Email/Password Login Submit
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        
        // Simulating authentication success
        modal.classList.remove('hidden');
    });

    // Face Login Step
    faceLoginBtn.addEventListener('click', () => {
        loginCard.classList.add('hidden');
        cameraCard.classList.remove('hidden');
        resetCameraUI();
        startCamera();
    });

    async function startCamera() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: 400, height: 300, facingMode: "user" }
            });
            currentStream = stream;
            video.srcObject = stream;
            
            video.onloadedmetadata = () => {
                cameraStatus.textContent = 'Live Camera: Ready to scan your face.';
                cameraStatus.style.color = 'var(--text-light)';
            };
        } catch (err) {
            console.error("Camera error:", err);
            cameraStatus.textContent = 'Camera access denied. Please allow camera.';
            cameraStatus.style.color = 'red';
            captureBtn.disabled = true;
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
        
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        cameraContainer.classList.add('hidden');
        previewContainer.classList.remove('hidden');
        
        captureBtn.classList.add('hidden');
        retakeBtn.classList.remove('hidden');
        verifyFaceBtn.classList.remove('hidden');
        
        cameraStatus.textContent = 'Face captured! Proceed to verify identity.';
        cameraStatus.style.color = 'var(--primary-green)';
    });

    retakeBtn.addEventListener('click', () => {
        resetCameraUI();
    });

    function resetCameraUI() {
        cameraContainer.classList.remove('hidden');
        previewContainer.classList.add('hidden');
        
        captureBtn.classList.remove('hidden');
        retakeBtn.classList.add('hidden');
        verifyFaceBtn.classList.add('hidden');
        
        cameraStatus.textContent = 'Live Camera: Ready to scan your face.';
        cameraStatus.style.color = 'var(--text-light)';
    }

    // Verify Identity
    verifyFaceBtn.addEventListener('click', () => {
        verifyFaceBtn.disabled = true;
        verifyFaceBtn.innerHTML = 'Verifying...';
        
        // Simulating API call for ML facial recognition
        setTimeout(() => {
            stopCamera();
            modal.classList.remove('hidden');
            verifyFaceBtn.disabled = false;
            verifyFaceBtn.innerHTML = 'Verify Identity';
        }, 1500);
    });

    // Back to Login Form
    backToFormBtn.addEventListener('click', () => {
        stopCamera();
        cameraCard.classList.add('hidden');
        loginCard.classList.remove('hidden');
    });

    // Close Modal
    closeModal.addEventListener('click', () => {
        modal.classList.add('hidden');
        cameraCard.classList.add('hidden');
        loginCard.classList.remove('hidden');
        form.reset();
    });
});

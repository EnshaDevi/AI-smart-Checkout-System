document.addEventListener('DOMContentLoaded', () => {
    // Fetch cart from local storage to populate stats
    const cart = JSON.parse(localStorage.getItem('cart') || '[]');
    
    let totalItems = 0;
    let subTotal = 0;
    
    cart.forEach(item => {
        totalItems += item.qty;
        subTotal += item.price * item.qty;
    });
    
    const tax = subTotal * 0.05;
    const finalAmount = subTotal + tax;
    
    // Update DOM
    const dashTotalItems = document.getElementById('dashTotalItems');
    const dashTotalAmount = document.getElementById('dashTotalAmount');
    
    if (dashTotalItems) dashTotalItems.textContent = totalItems;
    if (dashTotalAmount) dashTotalAmount.textContent = `₹ ${finalAmount.toFixed(2)}`;
    
    // Add hover sound effect logic if needed, but for now just basic JS is fine.
    
    console.log("Dashboard JS initialized successfully");
});

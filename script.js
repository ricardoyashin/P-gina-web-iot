// Seleccionamos el botón de hamburguesa y la lista de enlaces
const hamburger = document.querySelector('.hamburger');
const navLinks = document.querySelector('.nav-links');

// Añadimos un evento de 'click' al botón
hamburger.addEventListener('click', () => {
    // Cada vez que se hace clic, se añade o quita la clase 'active'.
    // El CSS se encarga de mostrar u ocultar el menú basado en esta clase.
    navLinks.classList.toggle('active');
});

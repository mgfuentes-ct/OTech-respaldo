// frontend/theme.js
document.addEventListener('DOMContentLoaded', () => {
    // Buscar la barra de navegación para inyectar el botón
    const navbar = document.querySelector('.navbar');
    if (!navbar) return; // Si no hay navbar, no hacemos nada (ej. login tal vez)

    const themeBtn = document.createElement('button');
    themeBtn.id = 'theme-toggle-btn';
    themeBtn.innerHTML = '☀️';
    themeBtn.title = 'Cambiar Tema';
    themeBtn.style.cssText = `
        background: transparent;
        border: 1px solid var(--border-soft);
        border-radius: 50%;
        width: 40px;
        height: 40px;
        font-size: 18px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        color: var(--text-main);
        transition: all 0.3s ease;
        margin-right: 16px;
        box-shadow: none;
        padding: 0;
    `;

    // Lo agregamos justo antes de la sección derecha ("usuario-nombre" / Cerrar Sesion)
    let navRight = navbar.querySelector('div[style*="margin-left: auto"]');
    
    // Si no existe navRight (ej. en crear-producto), lo agregamos directo con auto margin
    if (!navRight) {
        themeBtn.style.marginLeft = 'auto'; // empujar a la derecha
        navbar.appendChild(themeBtn);
    } else {
        navRight.insertBefore(themeBtn, navRight.firstChild);
    }

    // Lógica para aplicar el tema
    function aplicarTema(esClaro) {
        if (esClaro) {
            document.body.classList.add('light-theme');
            themeBtn.innerHTML = '🌙'; // Icono luna estando en claro
            localStorage.setItem('theme', 'light');
        } else {
            document.body.classList.remove('light-theme');
            themeBtn.innerHTML = '☀️'; // Icono sol estando en oscuro
            localStorage.setItem('theme', 'dark');
        }
    }

    // Inicializar estado previo
    const temaGuardado = localStorage.getItem('theme');
    if (temaGuardado === 'light') {
        aplicarTema(true);
    }

    themeBtn.addEventListener('click', () => {
        const isCurrentlyLight = document.body.classList.contains('light-theme');
        aplicarTema(!isCurrentlyLight);
    });

    // Efectos hover
    themeBtn.addEventListener('mouseenter', () => {
        themeBtn.style.transform = 'translateY(-2px)';
        themeBtn.style.background = 'var(--bg-glass-hover)';
    });
    themeBtn.addEventListener('mouseleave', () => {
        themeBtn.style.transform = 'translateY(0)';
        themeBtn.style.background = 'transparent';
    });
});

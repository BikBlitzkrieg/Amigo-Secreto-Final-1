// Variables globales
let participantes = [];
let asignaciones = {};
let sorteoRealizado = false;
const DURACION_MENSAJE = 2000; // Duración de los mensajes en milisegundos (2 segundos)
const PIN_VISIBILITY_DURATION = 400; // Duración en ms para que un dígito de PIN sea visible

// === Funciones de Utilidad ===
/**
 * Muestra un mensaje flotante en la parte inferior de la pantalla.
 * @param {string} texto - El texto del mensaje.
 * @param {'info' | 'success' | 'error'} tipo - El tipo de mensaje (determina el color).
 */
function mostrarMensaje(texto, tipo = 'info') {
    const mensaje = document.getElementById("mensaje");
    mensaje.innerText = texto;
    // Resetea las clases y añade la clase de tipo y la que lo hace visible
    mensaje.className = 'mensaje'; // Limpia clases anteriores
    mensaje.classList.add(tipo); // 'info', 'success', 'error'
    mensaje.classList.remove("hidden-message"); // Elimina la clase que lo oculta completamente

    setTimeout(() => {
        mensaje.classList.add("hidden-message"); // Añade de nuevo para ocultar
    }, DURACION_MENSAJE);
}

// === Lógica para el PIN Camuflado ===
let pinHideTimeouts = {}; // Objeto para guardar los timeouts de cada campo PIN

/**
 * Maneja la entrada de PIN, mostrando el último dígito por un momento y luego ocultándolo.
 * @param {HTMLInputElement} pinInput - El elemento input del PIN.
 */
function handlePinInput(pinInput) {
    const currentDisplayedValue = pinInput.value;
    let storedPin = pinInput.dataset.pinValue || ''; // Recupera el valor real del PIN

    // Limpia cualquier timeout anterior para este input
    if (pinHideTimeouts[pinInput.id]) {
        clearTimeout(pinHideTimeouts[pinInput.id]);
    }

    // Si el usuario borró un dígito
    if (currentDisplayedValue.length < storedPin.length) {
        storedPin = storedPin.substring(0, currentDisplayedValue.length);
        pinInput.dataset.pinValue = storedPin;
        // Solo necesitamos re-renderizar los asteriscos si se borró
        pinInput.value = '*'.repeat(storedPin.length);
        return;
    }

    // Si el usuario añadió un dígito
    if (currentDisplayedValue.length > storedPin.length) {
        const newChar = currentDisplayedValue.slice(-1); // Obtiene el último carácter ingresado

        // Asegurarse de que solo se añaden números
        if (!/^\d$/.test(newChar)) {
            // Si el carácter no es un dígito, revertir el input y mostrar mensaje
            pinInput.value = '*'.repeat(storedPin.length); // Vuelve a ocultar todo
            mostrarMensaje("Solo se permiten dígitos numéricos en el PIN.", "error");
            return;
        }

        storedPin += newChar;
        pinInput.dataset.pinValue = storedPin;

        // Muestra el último dígito temporalmente
        const tempDisplayedValue = '*'.repeat(storedPin.length - 1) + newChar;
        pinInput.value = tempDisplayedValue;

        // Programa el ocultamiento del último dígito
        pinHideTimeouts[pinInput.id] = setTimeout(() => {
            pinInput.value = '*'.repeat(storedPin.length);
        }, PIN_VISIBILITY_DURATION);
    } else {
        // Esto maneja casos donde el input no cambió su longitud (ej. pegar un PIN, aunque ya limitado por maxlength)
        // O si se completó un PIN de 4 dígitos.
        // Asegura que, si se ha introducido un PIN completo, se muestren asteriscos.
        pinInput.value = '*'.repeat(storedPin.length);
    }
}

// === Registro de participantes ===
function agregarParticipante() {
    const nombreInput = document.getElementById("nombre");
    const pinInput = document.getElementById("pin");
    const nombre = nombreInput.value.trim();
    // Acceder al valor real del PIN desde el dataset
    const pin = pinInput.dataset.pinValue || ''; 

    if (!nombre) {
        mostrarMensaje("Por favor, ingresa un nombre.", "error");
        return;
    }

    if (participantes.some(p => p.nombre.toLowerCase() === nombre.toLowerCase())) {
        mostrarMensaje("Ese nombre ya fue registrado.", "error");
        return;
    }

    // Validar PIN: debe tener exactamente 4 dígitos si se ingresa
    if (pin && pin.length !== 4) { // Ahora validamos la longitud del PIN real
        mostrarMensaje("El PIN debe tener exactamente 4 dígitos.", "error");
        return;
    }

    participantes.push({ nombre, pin });
    nombreInput.value = "";
    pinInput.dataset.pinValue = ""; // Limpiar el valor real del PIN
    pinInput.value = ""; // Limpiar el input visual
    renderListaParticipantes();
    mostrarMensaje(`"${nombre}" ha sido agregado.`, "success"); // Feedback de éxito
}

function renderListaParticipantes() {
    const lista = document.getElementById("listaParticipantes");
    lista.innerHTML = ""; // Limpia la lista antes de volver a renderizar

    if (participantes.length === 0) {
        // Muestra un mensaje amigable cuando no hay participantes
        lista.innerHTML = '<li class="instruccion">Nadie se ha registrado aún. ¡Sé el primero!</li>';
        // Ajustes de estilo para el estado vacío
        lista.style.border = 'none';
        lista.style.backgroundColor = 'transparent';
        lista.style.padding = '0';
        lista.style.boxShadow = 'none';
        return;
    } else {
        // Restaura los estilos si hay elementos
        lista.style.border = '';
        lista.style.backgroundColor = '';
        lista.style.padding = '';
        lista.style.boxShadow = '';
    }

    participantes.forEach((p, i) => {
        const li = document.createElement("li");
        li.classList.add("participant-item");
        li.innerHTML = `
            <span>${p.nombre}</span>
            <button onclick="eliminarParticipante(${i})" class="remove-btn">×</button>
        `;
        lista.appendChild(li);
    });
}

function eliminarParticipante(index) {
    const nombreEliminado = participantes[index].nombre;
    participantes.splice(index, 1);
    renderListaParticipantes();
    mostrarMensaje(`"${nombreEliminado}" ha sido eliminado.`, "info");
}

// === Sorteo ===
function realizarSorteo() {
    if (participantes.length < 2) {
        mostrarMensaje("Debe haber al menos dos participantes para realizar el sorteo.", "error");
        return;
    }

    let nombres = participantes.map(p => p.nombre);
    let posibles = shuffle([...nombres]);

    let intentos = 0;
    // Intenta generar una asignación válida hasta 1000 veces para evitar bucles infinitos
    while (!asignacionValida(nombres, posibles) && intentos < 1000) {
        posibles = shuffle([...nombres]);
        intentos++;
    }

    if (intentos === 1000) {
        mostrarMensaje("No se pudo realizar el sorteo con éxito. Intenta nuevamente.", "error");
        return;
    }

    asignaciones = {};
    nombres.forEach((nombre, i) => {
        asignaciones[nombre] = posibles[i];
    });

    sorteoRealizado = true;
    document.getElementById("pantalla-registro").classList.add("hidden");
    document.getElementById("pantalla-consulta").classList.remove("hidden");
    mostrarMensaje("¡Sorteo realizado con éxito! Ahora cada uno puede consultar su asignación.", "success");
}

// === Validación de asignaciones ===
function asignacionValida(originales, asignados) {
    for (let i = 0; i < originales.length; i++) {
        // 1. Nadie se regala a sí mismo
        if (originales[i] === asignados[i]) return false;
        
        // 2. Evita ciclos de 2 (A a B y B a A)
        const recipIndex = originales.indexOf(asignados[i]);
        if (recipIndex >= 0 && asignados[recipIndex] === originales[i]) return false;
    }
    return true;
}

// Función para mezclar un array (Fisher-Yates shuffle)
function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]]; // Intercambia elementos
    }
    return arr;
}

// === Consultar resultado individual ===
function consultarAsignado() {
    const consultaNombreInput = document.getElementById("consultaNombre");
    const consultaPinInput = document.getElementById("consultaPin");
    const nombre = consultaNombreInput.value.trim();
    // Acceder al valor real del PIN desde el dataset
    const pin = consultaPinInput.dataset.pinValue || ''; 
    const participante = participantes.find(p => p.nombre.toLowerCase() === nombre.toLowerCase());
    const resultadoDiv = document.getElementById("resultado");

    resultadoDiv.innerText = ""; // Limpiar resultado previo

    if (!sorteoRealizado) {
        mostrarMensaje("El sorteo aún no se ha realizado. ¡Intenta más tarde!", "info");
        return;
    }

    if (!nombre) {
        mostrarMensaje("Por favor, ingresa tu nombre para consultar.", "error");
        return;
    }

    if (!participante) {
        mostrarMensaje("El nombre ingresado no está registrado como participante.", "error");
        return;
    }

    // Validar PIN si el participante tiene uno
    if (participante.pin && pin !== participante.pin) {
        mostrarMensaje("PIN incorrecto para este participante.", "error");
        return;
    }

    // Validar si un PIN fue ingresado cuando el participante no tiene uno
    if (!participante.pin && pin) {
        mostrarMensaje("Este participante no tiene PIN. No debes ingresar uno.", "error");
        return;
    }
    
    // Si todo es correcto, muestra el resultado
    resultadoDiv.innerHTML = `¡Te toca regalar a <span>${asignaciones[participante.nombre]}</span>! 🎉`; // Usar <span> para aplicar estilos específicos al nombre
    mostrarMensaje("¡Resultado revelado! Recuerda guardar el secreto 😉", "success");
}

function borrarResultado() {
    document.getElementById("resultado").innerText = "";
    document.getElementById("consultaNombre").value = "";
    // Limpiar el valor real del PIN y el input visual
    const consultaPinInput = document.getElementById("consultaPin");
    consultaPinInput.dataset.pinValue = "";
    consultaPinInput.value = "";
    mostrarMensaje("Consulta borrada.", "info");
}

// === Reiniciar ===
function mostrarModalReinicio() {
    document.getElementById("modalReinicio").classList.add("active");
}

function cancelarReinicio() {
    document.getElementById("modalReinicio").classList.remove("active");
}

function reiniciarTodo() {
    participantes = [];
    asignaciones = {};
    sorteoRealizado = false;
    document.getElementById("pantalla-consulta").classList.add("hidden");
    document.getElementById("pantalla-registro").classList.remove("hidden");
    document.getElementById("nombre").value = ""; // Limpiar inputs de registro
    
    // Limpiar el valor real del PIN y el input visual para ambos campos
    const pinInputRegistro = document.getElementById("pin");
    pinInputRegistro.dataset.pinValue = "";
    pinInputRegistro.value = "";

    renderListaParticipantes(); // Para mostrar el mensaje de "nadie registrado"
    document.getElementById("resultado").innerText = "";
    document.getElementById("consultaNombre").value = "";
    
    const consultaPinInput = document.getElementById("consultaPin");
    consultaPinInput.dataset.pinValue = "";
    consultaPinInput.value = "";

    document.getElementById("claveAdmin").value = "";
    document.getElementById("listaResultados").innerHTML = "";
    document.getElementById("adminPanel").classList.remove("active");
    document.getElementById("modalClaveAdmin").classList.remove("active");
    // Esconder el botón de admin de nuevo
    document.getElementById("btnAdmin").classList.add("oculto");
    cancelarReinicio();
    mostrarMensaje("La aplicación ha sido reiniciada. ¡Comienza un nuevo sorteo!", "info");
}

// === Modo Admin ===
function mostrarPanelAdmin() {
    if (!sorteoRealizado) {
        mostrarMensaje("El sorteo aún no se ha realizado para ver resultados.", "error");
        return;
    }
    document.getElementById("modalClaveAdmin").classList.add("active");
}

function validarClaveAdmin() {
    const claveIngresada = document.getElementById("claveAdmin").value.trim();
    const CLAVE_ADMIN = "admin123"; // Puedes cambiar esta clave
    
    if (claveIngresada !== CLAVE_ADMIN) {
        mostrarMensaje("Clave incorrecta. Intenta de nuevo.", "error");
        document.getElementById("claveAdmin").value = ""; // Limpiar input
        return;
    }

    // Si la clave es correcta y el sorteo fue realizado
    if (!sorteoRealizado || Object.keys(asignaciones).length === 0) {
        mostrarMensaje("El sorteo aún no se ha realizado.", "error");
        // Asegúrate de cerrar el modal de la clave si la validación falla internamente
        document.getElementById("modalClaveAdmin").classList.remove("active"); 
        return;
    }

    const lista = document.getElementById("listaResultados");
    lista.innerHTML = "";

    Object.entries(asignaciones).forEach(([de, para]) => {
        const li = document.createElement("li");
        li.textContent = `${de} → ${para}`;
        lista.appendChild(li);
    });

    document.getElementById("modalClaveAdmin").classList.remove("active");
    document.getElementById("adminPanel").classList.add("active");
    mostrarMensaje("Resultados del sorteo mostrados (solo para administradores).", "info");
}

function ocultarPanelAdmin() {
    document.getElementById("adminPanel").classList.remove("active");
    document.getElementById("claveAdmin").value = ""; // Limpiar clave al cerrar
}

// Función para cerrar el modal de clave de administrador sin validar
function cerrarModalClaveAdmin() {
    document.getElementById("modalClaveAdmin").classList.remove("active");
    document.getElementById("claveAdmin").value = ""; // Limpiar el campo de la clave
}


// === Event Listeners ===
window.addEventListener("DOMContentLoaded", () => {
    // Inicializa la lista al cargar la página
    renderListaParticipantes(); 

    // --- Eventos de Botones ---
    document.getElementById("btnAgregar").addEventListener("click", agregarParticipante);
    document.getElementById("btnSortear").addEventListener("click", realizarSorteo);
    document.getElementById("btnConsultar").addEventListener("click", consultarAsignado);
    document.getElementById("btnBorrarConsulta").addEventListener("click", borrarResultado);
    
    // Asigna el evento a todos los botones con la clase .btnReiniciarConfirm
    document.querySelectorAll(".btnReiniciarConfirm").forEach(btn =>
        btn.addEventListener("click", mostrarModalReinicio)
    );

    document.getElementById("btnReiniciar").addEventListener("click", reiniciarTodo);
    document.getElementById("btnCancelarReinicio").addEventListener("click", cancelarReinicio);
    document.getElementById("btnValidarClave").addEventListener("click", validarClaveAdmin);
    document.getElementById("ocultarAdmin").addEventListener("click", ocultarPanelAdmin);

    // Evento para el botón "Cancelar" del modal de clave de administrador (ahora en HTML)
    document.getElementById("btnCerrarModalClaveAdmin").addEventListener("click", cerrarModalClaveAdmin);


    // --- Lógica del botón Admin (doble clic en título) ---
    const tituloConsulta = document.getElementById("tituloConsulta");
    if (tituloConsulta) {
        tituloConsulta.addEventListener("dblclick", () => { // dblclick para doble clic
            document.getElementById("btnAdmin").classList.remove("oculto");
            mostrarMensaje("Botón 'Admin' desbloqueado. Haz clic para acceder.", "info");
        });
    }

    // Mostrar modal clave admin (asumiendo que btnAdmin ya es visible o lo haces visible con dblclick)
    document.getElementById("btnAdmin").addEventListener("click", mostrarPanelAdmin);

    // --- Manejo del PIN camuflado ---
    const pinInputRegistro = document.getElementById("pin");
    const pinInputConsulta = document.getElementById("consultaPin");

    // Event listeners para el manejo visual del PIN
    if (pinInputRegistro) {
        pinInputRegistro.addEventListener('input', () => handlePinInput(pinInputRegistro));
    }
    if (pinInputConsulta) {
        pinInputConsulta.addEventListener('input', () => handlePinInput(pinInputConsulta));
    }
});
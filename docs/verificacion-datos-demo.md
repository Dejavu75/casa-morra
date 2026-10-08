# Verificación de datos de demostración

Ejecutar desde la raíz del repositorio:

```powershell
node --test
npm run verify:data
```

El segundo comando imprime un informe JSON con `ok`, las cantidades de jugadores, torneos, partidas y descansos, y una lista de errores. Termina con código distinto de cero cuando detecta discrepancias. Para la muestra comprometida en esta unidad, el resultado esperado es `ok: true`, **6 jugadores, 6 torneos, 70 partidas y 5 descansos**, sin errores.

El verificador contrasta identificadores y referencias, puntos y G-E-P de tablas reconstruibles, actualizaciones Elo demo, tabla anual, perfiles y contadores de portada, directorio y torneos. Las tablas oficiales sin detalle de partidas permanecen separadas: no se inventan jugadas ni resultados individuales para conciliarlas.

Este control usa los datos ficticios y el código del mismo commit. No valida la legalidad de todas las jugadas, la fidelidad del sitio de referencia, las interacciones reales del navegador, la imagen Docker ni una ejecución remota de CI. Esas comprobaciones requieren evidencia independiente antes de aceptar la entrega.

# Pull Request: Fix item cooldown animation

## Base
Comparado contra `main` de `LB JS Demo`.

## Cambios
- Clampa la fraccion de cooldown entre 0 y 1.
- Corrige la rotacion de la aguja para que avance con el progreso real.
- Elimina la linea fija duplicada del temporizador circular.

## Motivo
El estado final evita rotaciones incorrectas y overlays visuales raros cuando el cooldown queda fuera de rango.

## Verificacion
- Pendiente ejecutar `npm run type-check` en esta rama aislada.

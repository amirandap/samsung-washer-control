# Samsung WD11FG6B34BB — Especificaciones y referencia técnica

> Documento de referencia para el desarrollo de washer-app.
> Modelo: **Samsung WD11FG6B34BB ED** (Beige) — Lavadora-secadora de carga frontal, Serie 6.

---

## Especificaciones generales

| Parámetro | Valor |
|-----------|-------|
| Tipo | Lavadora-secadora integrada (washer-dryer combo) |
| Carga | Frontal |
| Capacidad lavado | **11 kg** (≈ 24.2 lbs) |
| Capacidad secado | **7 kg** (≈ 15.4 lbs) |
| Velocidad centrifugado máx. | **1400 rpm** |
| Clase energética | D (EU 2021) |
| Consumo lavado 60°C algodón | ~0.59 kWh |
| Consumo secado algodón completo | ~4.18 kWh |
| Ruido lavado / centrifugado | ~49 / 74 dB(A) |
| Voltaje / Frecuencia | 220–240 V / 50 Hz |
| Dimensiones (Al×An×Pr) | 850 × 600 × 600 mm |
| Peso | ~77 kg |
| Color | Beige (serie Bespoke) |

---

## Tecnologías clave

### EcoBubble™
Disuelve el detergente en burbujas antes de la entrada al tambor. Permite lavar eficazmente a temperaturas bajas (incluso agua fría), cuidando la ropa y reduciendo el consumo energético. Reduce la dosis de detergente necesaria aprox. 15%.

### AI Control
- Analiza el tipo de tela, nivel de suciedad y carga.
- Recomienda ciclos y temperatura automáticamente.
- Aprende los hábitos del usuario con el tiempo.
- Integración con SmartThings para control y monitoreo remoto.

### Auto Dose (dispensador automático)
- Reservorio de detergente líquido (~300–400 ml).
- Dosis automática ajustada al peso de la carga detectada.
- Reduce desperdicio de detergente hasta un 30%.

### SmartThings / Wi-Fi
- Control y monitoreo desde app SmartThings (iOS/Android).
- Remote Start: iniciar ciclo remotamente (requiere Smart Control activado en la lavadora).
- Notificaciones de fin de ciclo.
- Diagnóstico inteligente (Smart Care): auto-detección de problemas vía app.
- Compatible con la API SmartThings (usada en washer-app).

---

## Programas de lavado

| Código API SmartThings | Nombre en pantalla | Temp. recomendada | Carga máx. | Notas |
|------------------------|-------------------|-------------------|------------|-------|
| `normalCourse` | Normal | 40–60 °C | 11 kg | Algodón cotidiano |
| `cottonCourse` | Algodones | 40–95 °C | 11 kg | Camisas, ropa de cama |
| `colorCourse` | Colores | 30–40 °C | 11 kg | Ropa de color |
| `darkCourse` | Oscuros | 30 °C | 11 kg | Negros, azul marino |
| `delicateCourse` | Delicados | 30 °C | 2 kg | Seda, encajes |
| `woolCourse` | Lana | 30 °C | 2 kg | Requiere centrifugado bajo |
| `syntheticsCourse` | Sintéticos | 40 °C | 5.5 kg | Poliéster, nylon |
| `bedSheetsCourse` | Ropa de cama | 60 °C | 7 kg | Sábanas, fundas |
| `duvets` | Edredón | 30–40 °C | 7 kg | Sin centrifugado agresivo |
| `quickWashCourse` | Rápido 15′ | 30 °C | 2 kg | Piezas poco sucias |
| `sportsCourse` | Deporte | 30–40 °C | 4 kg | Fibras técnicas |
| `outerWear` | Ropa exterior | 30 °C | 2 kg | Cortavientos, softshell |
| `hygieneSteam` | Higiene + Vapor | 60–95 °C | 3 kg | Elimina gérmenes con vapor |
| `rinseCourse` | Enjuague | — | 11 kg | Solo enjuague |
| `spinCourse` | Centrifugado | — | 11 kg | Solo centrifugado |
| `rinseHoldCourse` | Enjuague + Pausa | — | 11 kg | Retiene agua al final |
| `intensiveWash` | Lavado intensivo | 60–95 °C | 7 kg | Ropa muy sucia |

---

## Velocidades de centrifugado (SmartThings API)

| Valor API | RPM equivalente | Uso recomendado |
|-----------|-----------------|-----------------|
| `no` | 0 rpm | Sin centrifugado (edredones, lana) |
| `rinseHold` | ~600 rpm | Muy delicado |
| `low` | 600 rpm | Delicados, lana |
| `medium` | 800 rpm | Sintéticos, colores |
| `high` | 1000 rpm | Normal, algodón |
| `extraHigh` | 1200 rpm | Algodón, sábanas |
| *(máx. físico)* | 1400 rpm | No accesible vía SmartThings API directamente |

---

## Temperaturas disponibles (API)

| Valor API | Temperatura | Uso |
|-----------|-------------|-----|
| `cold` | 20–30 °C | Colores, oscuros, delicados, EcoBubble |
| `warm` | 40 °C | Normal, sintéticos, deporte |
| `hot` | 60 °C | Algodón, higiene, camas |
| `extraHot` | 90–95 °C | Algodón blanco, desinfección |

---

## Capacidades de carga recomendadas en lbs

| Tipo de ciclo | Capacidad kg | Capacidad lbs |
|---------------|-------------|---------------|
| Carga completa (algodón) | 11 kg | 24.2 lbs |
| Edredón / Ropa de cama | 7 kg | 15.4 lbs |
| Deporte / Sintéticos | 4–5.5 kg | 8.8–12.1 lbs |
| Delicados / Lana | 2 kg | 4.4 lbs |
| Lavado rápido | 2 kg | 4.4 lbs |
| Secado completo | 7 kg | 15.4 lbs |

---

## Programas de secado

| Programa | Notas |
|----------|-------|
| Algodón seco en armario | Temperatura alta, secado completo |
| Algodón listo para planchar | Deja ligeramente húmedo |
| Sintéticos secos | Temperatura baja |
| Mixto | Combina algodón y sintéticos |
| Tiempo libre (30/45/60/90 min) | Control manual |

---

## Funciones adicionales notables

- **Add Item**: permite abrir la puerta durante el ciclo (primeros minutos) para agregar prendas.
- **Delay Start**: programa inicio hasta 24 h después.
- **Child Lock**: bloqueo de controles para niños.
- **Drum Light**: iluminación LED interior del tambor.
- **Self Clean+**: ciclo de limpieza del tambor (sin ropa, sin detergente). Recomendado cada 40 lavados.
- **Smart Check**: diagnóstico de errores via app SmartThings.

---

## Notas para washer-app

### Capability names (SmartThings)
```
custom.washerWashCourse          → ciclo de lavado
custom.washerWashTemperature     → temperatura
custom.washerSpinLevel           → velocidad centrifugado
washerOperatingState             → estado (machineState, washerJobState, completionTime)
remoteControlStatus              → remoteControlEnabled (bool)
samsungce.ecoBubble              → ecoBubble (on/off)
```

### Flujo para Remote Start
1. Verificar `remoteControlEnabled === true` antes de enviar comandos.
2. Si es `false`, el usuario debe activar "Smart Control" en el panel de la lavadora.
3. Enviar comandos en orden: ciclo → temperatura → centrifugado → EcoBubble → start.

### Dosis de detergente (referencia)
- Base: ~13 ml/kg (~65 ml para carga de 5 kg).
- Con EcoBubble: reducir 15%.
- Ciclos delicados (lana, delicados, sintéticos, rápido): reducir 25%.
- Agua caliente (60°C+): reducir 10% (mejor disolución).
- Agua fría: aumentar 5%.
- El dispensador Auto Dose del modelo gestiona la dosis automáticamente si se usa su reservorio.

### Conversión de unidades
- 1 kg = 2.20462 lbs
- La interfaz de washer-app muestra el peso en **lbs** y convierte internamente a kg.
- Capacidad máxima de lavado: 24.2 lbs (11 kg).

---

*Documento generado el 2026-05-01 para washer-app. Modelo verificado: Samsung WD11FG6B34BB ED.*

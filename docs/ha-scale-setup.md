# Integrar báscula Etekcity ESF-551 en Home Assistant y enviar peso a washer-app

## Objetivo
Instalar la integración BLE de la báscula en HA, y configurar una automatización que envíe el peso (en lbs) al webhook de washer-app cada vez que la báscula registre un nuevo peso.

---

## 1. Instalar integración HACS: Etekcity Fitness Scale BLE

1. Abrir HACS → Integrations → menú ⋮ → Custom repositories
2. Agregar URL: `https://github.com/ronnnnnnnnnnnnn/etekcity_fitness_scale_ble` — categoría: Integration
3. Buscar "Etekcity Fitness Scale BLE" y hacer clic en Download
4. Reiniciar Home Assistant
5. Ir a Settings → Integrations → Add Integration → buscar "Etekcity Fitness Scale BLE"
6. Configurar unidad: **Imperial (lbs)**
7. Después del emparejamiento, se crearán sensores. El sensor de peso será algo como `sensor.etekcity_scale_weight` con `unit_of_measurement: lbs`

---

## 2. Obtener el webhook secret de washer-app

Hacer esta llamada para obtener la URL y el secret:

```
GET https://home.appsofi.com/lavadora/api/webhook/scale/info
```

Respuesta esperada:
```json
{
  "url": "https://home.appsofi.com/lavadora/api/webhook/scale",
  "secret": "TU_SECRET_AQUI",
  "header": "X-Webhook-Token"
}
```

---

## 3. Agregar rest_command en `configuration.yaml`

```yaml
rest_command:
  washer_scale_webhook:
    url: "https://home.appsofi.com/lavadora/api/webhook/scale"
    method: POST
    headers:
      X-Webhook-Token: "TU_SECRET_AQUI"
      Content-Type: "application/json"
    payload: '{"weight_lbs": {{ weight_lbs }}}'
```

---

## 4. Crear automatización

```yaml
automation:
  - alias: "Enviar peso báscula a washer-app"
    description: "Cuando la báscula Etekcity registra un nuevo peso, lo envía al webhook de washer-app"
    trigger:
      - platform: state
        entity_id: sensor.etekcity_scale_weight   # ajustar al entity_id real
    condition:
      - condition: template
        value_template: "{{ trigger.to_state.state | float(0) > 0 }}"
      - condition: template
        value_template: "{{ trigger.to_state.state != trigger.from_state.state }}"
    action:
      - service: rest_command.washer_scale_webhook
        data:
          weight_lbs: "{{ trigger.to_state.state | float | round(1) }}"
```

---

## 5. Verificar que funciona

Después de crear la automatización, pisar la báscula. En el log de HA deberías ver la llamada REST ejecutarse. En washer-app, al abrir el modal "Aplicar preset", el peso debe aparecer automáticamente en lbs en el widget de báscula.

También podés probar el webhook manualmente con curl:
```bash
curl -X POST https://home.appsofi.com/lavadora/api/webhook/scale \
  -H "X-Webhook-Token: TU_SECRET_AQUI" \
  -H "Content-Type: application/json" \
  -d '{"weight_lbs": 12.5}'
```

---

## 6. Agregar Samsung Washer en Home Assistant (SmartThings)

### 6.1 Crear un Personal Access Token en SmartThings

1. Ir a https://account.smartthings.com/tokens
2. Hacer clic en **Generate new token**
3. Nombre: `Home Assistant`
4. Scopes requeridos: `Devices (read)`, `Devices (execute)`, `Scenes (read/execute)`
5. Copiar el token generado (se muestra solo una vez)

### 6.2 Credenciales OAuth de washer-app (para referencia)

Estos son los datos del OAuth App registrado en SmartThings Developer Console para washer-app:

| Campo | Valor |
|-------|-------|
| **Client ID** | `b0718cd9-7af9-489c-b4ac-c9ed8f9d0424` |
| **Client Secret** | `69975c3b-4796-48af-9510-1c0f37b2af68` |
| **Device ID** | `25c2b397-775a-53e9-72f5-ee4a9c07398e` |
| **Device Label** | `Washer` |

> ⚠️ Estos son los credentials del OAuth app de washer-app — no del PAT de HA.  
> Para la integración nativa de HA usar el PAT del paso 6.1.

### 6.3 Agregar la integración SmartThings en HA

1. Ir a **Settings → Integrations → Add Integration**
2. Buscar **SmartThings**
3. Ingresar el Personal Access Token del paso 6.1
4. HA descubrirá todos los dispositivos. El washer aparecerá como `switch.washer` o `sensor.washer_*`
5. En Developer Tools → States buscar `washer` para ver todos los atributos disponibles

### 6.4 Automatización: notificar cuando termine la lavadora

```yaml
automation:
  - alias: "Notificar lavadora terminada"
    description: "Envía notificación push cuando la lavadora termina el ciclo"
    trigger:
      - platform: state
        entity_id: sensor.washer_washer_job_state   # ajustar al entity_id real
        to: "finish"
    action:
      - service: notify.mobile_app_tu_telefono       # ajustar al dispositivo real
        data:
          title: "🫧 Lavadora lista"
          message: "El ciclo terminó. ¡Saca la ropa!"
```

> Para encontrar el entity_id exacto: Developer Tools → States → buscar "washer"  
> Para encontrar el notify service: Developer Tools → Actions → buscar "notify"

---

## Notas
- El sensor exacto de la báscula depende del nombre que HA asigne. Verificarlo en Developer Tools → States buscando "etekcity"
- El webhook acepta `weight_lbs` (preferido) o `weight_kg` (fallback)
- El secret del webhook se genera automáticamente en la primera llamada y queda guardado en la DB de washer-app

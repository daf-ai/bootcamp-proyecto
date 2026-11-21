# AulaChain — Administrador académico en Solana

Aplicación de ejemplo para registrar tareas académicas en Solana Devnet. Incluye un programa Rust/Anchor, frontend React + TypeScript con conexión de wallet, derivación de PDAs, cliente Anchor, pruebas y pasos para obtener una transacción verificable.

> **Estado importante:** este repositorio es el código fuente y scaffold reproducible. No está desplegado todavía: el despliegue requiere que ejecutes Anchor/Solana con tu propia wallet y firmes la transacción. No se inventa una firma ni se presenta el Program ID de sistema como si fuera un programa desplegado.

## Aporte funcional

AulaChain permite:
- Crear un perfil por wallet (`PDA = ["profile", authority]`).
- Crear tareas asociadas al estudiante (`PDA = ["task", authority, task_id_le]`).
- Consultar las tareas del propietario desde el programa.
- Actualizar título, descripción y estado.
- Cerrar una cuenta únicamente cuando `completed == true`; el alquiler se devuelve al propietario.
- Rechazar título vacío, textos demasiado largos, IDs duplicados, wallets ajenas y cierres prematuros.

## Arquitectura

- `programs/aula_chain/src/lib.rs`: programa on-chain en Rust + Anchor.
- `src/App.tsx`: interfaz web y operaciones CRUD.
- `src/chain.ts`: derivación PDA y cliente Anchor.
- `src/idl/aula_chain.json`: IDL de referencia. **Debe regenerarse con `anchor build` después de fijar el Program ID real**; el IDL generado por Anchor es la fuente de verdad.
- `tests/aula_chain.ts`: pruebas de creación, rechazo de cierre prematuro, actualización, cierre y validación de título.

## Requisitos

- Rust y Cargo.
- Solana CLI compatible con tu versión de Anchor.
- Anchor CLI 0.30.1.
- Node.js 18+ y Yarn.
- Phantom o Solflare configurada en Devnet.

## Instalación y despliegue en Devnet

1. Instala dependencias:
   ```bash
   yarn install
   ```
2. Configura Solana Devnet y una wallet de pruebas:
   ```bash
   solana config set --url devnet
   solana address
   solana airdrop 2
   solana balance
   ```
   El airdrop puede estar sujeto a límites de la red. Usa únicamente SOL de prueba.
3. Genera el keypair del programa:
   ```bash
   anchor keys list
   ```
   Si aún no existe, ejecuta `anchor build` y luego `anchor keys sync`.
4. Copia el Program ID generado por `anchor keys list` en:
   - `declare_id!(...)` de `programs/aula_chain/src/lib.rs`
   - `[programs.devnet]` de `Anchor.toml`
   - `PROGRAM_ID` de `src/chain.ts`
5. Construye el programa y genera el IDL real:
   ```bash
   anchor build
   ```
   Copia `target/idl/aula_chain.json` a `src/idl/aula_chain.json` (ajusta el import si tu configuración genera el IDL en otra ruta).
6. Despliega:
   ```bash
   anchor deploy --provider.cluster devnet
   ```
7. Ejecuta pruebas:
   ```bash
   anchor test --provider.cluster devnet
   ```
   Para pruebas repetibles y aisladas, también puedes iniciar un validador local con `anchor test` sin `--provider.cluster devnet`.

## Ejecutar frontend

```bash
yarn dev
```
Abre la URL que muestra Vite. Conecta Phantom/Solflare, cambia la wallet a **Devnet**, crea el perfil y registra una tarea. Consulta con “Actualizar”; marca la tarea como completada y después usa “Cerrar cuenta”.

## Instrucciones y reglas de seguridad

| Operación | Regla |
|---|---|
| Crear perfil | Solo se inicializa una vez por wallet |
| Crear tarea | Requiere perfil del mismo propietario; ID único por wallet |
| Consultar | Filtra las cuentas por autoridad |
| Actualizar | `has_one = authority` y firma del propietario |
| Cerrar | Solo propietario y `completed == true` |

Las restricciones se validan on-chain, no solo en el frontend. La PDA evita colisiones entre usuarios para un mismo ID. El cierre usa `close = authority`, por lo que Anchor devuelve el rent al dueño autorizado.

## Evidencia verificable de transacción

Después de desplegar y ejecutar una operación desde la interfaz:
1. Copia la firma que muestra Phantom o el registro de la transacción.
2. Abre `https://explorer.solana.com/tx/TU_FIRMA?cluster=devnet`.
3. Guarda captura donde se vean la firma, estado **Success**, programa invocado y cluster **Devnet**.
4. Añade la captura y la firma a `evidence/` y completa `evidence/README.md`.

No se incluye una firma ficticia: una transacción verificable solo existe después de que una wallet firme y la red la confirme.

## Limitación técnica a revisar antes de entrega

El IDL dentro de `src/idl` es un archivo de arranque ilustrativo; Anchor genera los discriminadores correctos según los nombres reales de las instrucciones y cuentas. Para compilar y ejecutar, **usa siempre el IDL generado en `target/idl`** y reemplaza el archivo de referencia. El Program ID inicial es un marcador temporal (System Program), no es el programa AulaChain desplegado. Debes ejecutar `anchor keys sync`, copiar el ID generado a `src/chain.ts` y usar el IDL recién generado antes de iniciar el frontend.

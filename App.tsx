import { useMemo, useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { AnchorProvider, BN } from '@coral-xyz/anchor';
import { getProgram, getProfilePda, getTaskPda, PROGRAM_ID, ensureProfile } from './chain';

type Task = { id: number; title: string; description: string; completed: boolean; address: string; createdAt: string };
export default function App() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [name, setName] = useState('Estudiante');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [taskId, setTaskId] = useState('1');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [message, setMessage] = useState('Conecta tu wallet para comenzar.');
  const [busy, setBusy] = useState(false);
  const provider = useMemo(() => wallet.publicKey && wallet.signTransaction && wallet.signAllTransactions
    ? new AnchorProvider(connection, wallet as any, { commitment: 'confirmed' }) : null, [connection, wallet]);
  const ready = !!provider && !!wallet.publicKey;

  async function run(action: () => Promise<void>) {
    setBusy(true); setMessage('Procesando transacción…');
    try { await action(); } catch (e: any) { setMessage(`Operación rechazada: ${e?.message ?? e}`); }
    finally { setBusy(false); }
  }
  async function createProfile() {
    if (!provider || !wallet.publicKey) return;
    const program = getProgram(provider);
    await ensureProfile(program, wallet.publicKey, name);
    setMessage('Perfil verificado o creado correctamente.');
  }
  async function createTask() {
    if (!provider || !wallet.publicKey) return;
    const id = Number(taskId);
    if (!Number.isSafeInteger(id) || id < 0 || !title.trim()) throw new Error('ID inválido o título vacío.');
    const program = getProgram(provider);
    const profile = getProfilePda(wallet.publicKey);
    const profileInfo = await connection.getAccountInfo(profile);
    if (!profileInfo) throw new Error('Primero crea tu perfil.');
    await program.methods.createTask(new BN(id), title, description).accounts({
      authority: wallet.publicKey, profile, task: getTaskPda(wallet.publicKey, id)
    }).rpc();
    setMessage('Tarea creada en Devnet. Actualiza la lista para consultarla.');
    await loadTasks();
  }
  async function loadTasks() {
    if (!provider || !wallet.publicKey) return;
    const program = getProgram(provider);
    const rows = await program.account.academicTask.all([
      { memcmp: { offset: 8, bytes: wallet.publicKey.toBase58() } }
    ]);
    setTasks(rows.map((r: any) => ({
      id: Number(r.account.taskId.toString()), title: r.account.title, description: r.account.description,
      completed: r.account.completed, address: r.publicKey.toBase58(),
      createdAt: new Date(Number(r.account.createdAt.toString()) * 1000).toLocaleString()
    })).sort((a: Task,b: Task) => a.id-b.id));
    setMessage(`Consulta completada: ${rows.length} tarea(s) encontrada(s).`);
  }
  async function updateTask(t: Task, completed: boolean) {
    if (!provider || !wallet.publicKey) return;
    const program = getProgram(provider);
    await program.methods.updateTask(t.title, t.description, completed).accounts({
      authority: wallet.publicKey, task: new (await import('@solana/web3.js')).PublicKey(t.address)
    }).rpc();
    await loadTasks();
  }
  async function closeTask(t: Task) {
    if (!provider || !wallet.publicKey) return;
    if (!t.completed) throw new Error('Solo puedes cerrar tareas completadas.');
    const program = getProgram(provider);
    await program.methods.closeTask().accounts({
      authority: wallet.publicKey, task: new (await import('@solana/web3.js')).PublicKey(t.address)
    }).rpc();
    await loadTasks();
  }
  return <main className="shell">
    <header><div><div className="eyebrow">SOLANA DEVNET · ANCHOR + RUST</div><h1>Aula<span>Chain</span></h1><p>Organiza tus actividades académicas con registros verificables.</p></div><WalletMultiButton /></header>
    <section className="hero"><div><span className="pill">● Red de pruebas</span><h2>Tus tareas, registradas en blockchain.</h2><p>Cada tarea tiene una dirección PDA propia y solo su propietario puede modificarla.</p></div><div className="heroIcon">✦</div></section>
    {!ready && <div className="notice">Conecta Phantom o Solflare y cambia tu wallet a <b>Devnet</b>. Usa SOL de prueba, nunca fondos reales.</div>}
    <section className="grid">
      <article className="panel"><h3>01 / Perfil de estudiante</h3><p>Se crea una cuenta PDA asociada a tu wallet.</p><label>Nombre visible</label><input value={name} onChange={e=>setName(e.target.value)} maxLength={40}/><button disabled={!ready||busy} onClick={()=>run(createProfile)}>Crear / verificar perfil</button></article>
      <article className="panel"><h3>02 / Nueva tarea</h3><p>El ID, tu wallet y la semilla generan la PDA.</p><label>ID numérico único</label><input value={taskId} onChange={e=>setTaskId(e.target.value)} type="number" min="0"/><label>Título</label><input value={title} onChange={e=>setTitle(e.target.value)} maxLength={80} placeholder="Ej. Entregar práctica de física"/><label>Descripción</label><textarea value={description} onChange={e=>setDescription(e.target.value)} maxLength={280} placeholder="Detalles de la actividad…"/><button disabled={!ready||busy} onClick={()=>run(createTask)}>Registrar tarea</button></article>
    </section>
    <section className="panel taskPanel"><div className="taskHead"><div><h3>03 / Mis tareas</h3><p>Consulta, actualiza el estado o cierra una tarea completada.</p></div><button className="secondary" disabled={!ready||busy} onClick={()=>run(loadTasks)}>↻ Actualizar</button></div>
      {tasks.length===0?<div className="empty">Aún no hay tareas cargadas. Crea una y pulsa “Actualizar”.</div>:tasks.map(t=><div className="task" key={t.address}><div className="taskInfo"><span className={t.completed?'status done':'status'}>{t.completed?'Completada':'Pendiente'}</span><h4>#{t.id} · {t.title}</h4><p>{t.description||'Sin descripción'}</p><small>Creada: {t.createdAt}</small><small className="address">{t.address}</small></div><div className="actions"><button className="secondary" disabled={busy} onClick={()=>run(()=>updateTask(t,!t.completed))}>{t.completed?'Reabrir':'Completar'}</button><button className="danger" disabled={busy||!t.completed} title={!t.completed?'Completa la tarea antes de cerrarla':''} onClick={()=>run(()=>closeTask(t))}>Cerrar cuenta</button></div></div>)}
    </section>
    <footer><div className="message">{busy?'◌ ': '◆ '}{message}</div><p>Program ID configurado: <code>{PROGRAM_ID.toBase58()}</code> · <a href="https://explorer.solana.com/?cluster=devnet" target="_blank" rel="noreferrer">Solana Explorer Devnet ↗</a></p></footer>
  </main>;
}

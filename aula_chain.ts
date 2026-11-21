import * as anchor from '@coral-xyz/anchor';
import { Program, AnchorProvider, BN } from '@coral-xyz/anchor';
import { expect } from 'chai';
import { PublicKey, SystemProgram, Keypair } from '@solana/web3.js';
import { describe, it } from 'mocha';

describe('aula_chain (Devnet/local validator)', () => {
  const provider = AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.AulaChain as Program;
  const owner = provider.wallet.publicKey;
  const id = new BN(Date.now());
  const profile = PublicKey.findProgramAddressSync([Buffer.from('profile'), owner.toBuffer()], program.programId)[0];
  const task = PublicKey.findProgramAddressSync([Buffer.from('task'), owner.toBuffer(), id.toArrayLike(Buffer,'le',8)], program.programId)[0];

  it('creates profile and task, then rejects premature close', async () => {
    const profileInfo = await provider.connection.getAccountInfo(profile);
    if (!profileInfo) await program.methods.initializeStudent('Prueba').accounts({
      authority: owner, profile, systemProgram: SystemProgram.programId
    }).rpc();
    await program.methods.createTask(id, 'Tarea de prueba', 'Registro de validación').accounts({
      authority: owner, profile, task, systemProgram: SystemProgram.programId
    }).rpc();
    try {
      await program.methods.closeTask().accounts({ authority: owner, task }).rpc();
      expect.fail('Debió rechazar el cierre de una tarea pendiente');
    } catch (e: any) {
      expect(String(e)).to.match(/TaskNotCompleted|6004|completed/i);
    }
    await program.methods.updateTask('Tarea de prueba', 'Registro de validación', true).accounts({ authority: owner, task }).rpc();
    await program.methods.closeTask().accounts({ authority: owner, task }).rpc();
    expect(await provider.connection.getAccountInfo(task)).to.equal(null);
  });

  it('rejects an empty title', async () => {
    const anotherId = id.addn(1);
    const anotherTask = PublicKey.findProgramAddressSync([Buffer.from('task'), owner.toBuffer(), anotherId.toArrayLike(Buffer,'le',8)], program.programId)[0];
    try {
      await program.methods.createTask(anotherId, '', '').accounts({
        authority: owner, profile, task: anotherTask, systemProgram: SystemProgram.programId
      }).rpc();
      expect.fail('Debió rechazar el título vacío');
    } catch (e: any) {
      expect(String(e)).to.match(/InvalidTitle|6002|título/i);
    }
  });
});

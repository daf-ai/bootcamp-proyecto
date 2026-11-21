use anchor_lang::prelude::*;

declare_id!("11111111111111111111111111111111");

#[program]
pub mod aula_chain {
    use super::*;

    pub fn initialize_student(ctx: Context<InitializeStudent>, display_name: String) -> Result<()> {
        require!(!display_name.trim().is_empty(), AulaError::EmptyName);
        require!(display_name.len() <= 40, AulaError::NameTooLong);
        let profile = &mut ctx.accounts.profile;
        profile.authority = ctx.accounts.authority.key();
        profile.display_name = display_name;
        profile.task_count = 0;
        profile.bump = ctx.bumps.profile;
        Ok(())
    }

    pub fn create_task(ctx: Context<CreateTask>, task_id: u64, title: String, description: String) -> Result<()> {
        validate_text(&title, 80, AulaError::InvalidTitle)?;
        require!(description.len() <= 280, AulaError::DescriptionTooLong);

        let task = &mut ctx.accounts.task;
        task.authority = ctx.accounts.authority.key();
        task.task_id = task_id;
        task.title = title;
        task.description = description;
        task.completed = false;
        task.created_at = Clock::get()?.unix_timestamp;
        task.bump = ctx.bumps.task;

        let profile = &mut ctx.accounts.profile;
        profile.task_count = profile.task_count.checked_add(1).ok_or(AulaError::CounterOverflow)?;
        Ok(())
    }

    pub fn update_task(ctx: Context<UpdateTask>, title: String, description: String, completed: bool) -> Result<()> {
        validate_text(&title, 80, AulaError::InvalidTitle)?;
        require!(description.len() <= 280, AulaError::DescriptionTooLong);

        let task = &mut ctx.accounts.task;
        task.title = title;
        task.description = description;
        task.completed = completed;
        Ok(())
    }

    pub fn close_task(_ctx: Context<CloseTask>) -> Result<()> {
        // Anchor's `close = authority` returns the rent to the task owner.
        // The `has_one` and `constraint` checks run before this instruction.
        Ok(())
    }
}

fn validate_text(value: &str, max: usize, error: AulaError) -> Result<()> {
    require!(!value.trim().is_empty(), error);
    require!(value.len() <= max, error);
    Ok(())
}

#[derive(Accounts)]
pub struct InitializeStudent<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        init,
        payer = authority,
        space = 8 + StudentProfile::INIT_SPACE,
        seeds = [b"profile", authority.key().as_ref()],
        bump
    )]
    pub profile: Account<'info, StudentProfile>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(task_id: u64)]
pub struct CreateTask<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        mut,
        seeds = [b"profile", authority.key().as_ref()],
        bump = profile.bump,
        has_one = authority
    )]
    pub profile: Account<'info, StudentProfile>,
    #[account(
        init,
        payer = authority,
        space = 8 + AcademicTask::INIT_SPACE,
        seeds = [b"task", authority.key().as_ref(), &task_id.to_le_bytes()],
        bump
    )]
    pub task: Account<'info, AcademicTask>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateTask<'info> {
    pub authority: Signer<'info>,
    #[account(
        mut,
        seeds = [b"task", authority.key().as_ref(), &task.task_id.to_le_bytes()],
        bump = task.bump,
        has_one = authority
    )]
    pub task: Account<'info, AcademicTask>,
}

#[derive(Accounts)]
pub struct CloseTask<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        mut,
        seeds = [b"task", authority.key().as_ref(), &task.task_id.to_le_bytes()],
        bump = task.bump,
        has_one = authority,
        constraint = task.completed @ AulaError::TaskNotCompleted,
        close = authority
    )]
    pub task: Account<'info, AcademicTask>,
}

#[account]
#[derive(InitSpace)]
pub struct StudentProfile {
    pub authority: Pubkey,
    #[max_len(40)]
    pub display_name: String,
    pub task_count: u64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct AcademicTask {
    pub authority: Pubkey,
    pub task_id: u64,
    #[max_len(80)]
    pub title: String,
    #[max_len(280)]
    pub description: String,
    pub completed: bool,
    pub created_at: i64,
    pub bump: u8,
}

#[error_code]
pub enum AulaError {
    #[msg("El nombre no puede estar vacío.")]
    EmptyName,
    #[msg("El nombre supera los 40 caracteres.")]
    NameTooLong,
    #[msg("El título debe tener entre 1 y 80 caracteres.")]
    InvalidTitle,
    #[msg("La descripción supera los 280 caracteres.")]
    DescriptionTooLong,
    #[msg("No se puede cerrar una tarea que no está completada.")]
    TaskNotCompleted,
    #[msg("El contador de tareas excedió su capacidad.")]
    CounterOverflow,
}

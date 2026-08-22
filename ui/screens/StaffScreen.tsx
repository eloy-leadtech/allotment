import {
  formatEuros,
  STAFF_ROLES,
  staffOptions,
  staffLevel,
  staffSalary,
  staffWageBill,
} from '@game';
import { useGameStore } from '@ui/store/gameStore';
import { RetroButton } from '@ui/components/RetroButton';
import { RetroPanel } from '@ui/components/RetroPanel';
import { GestHeader } from '@ui/components/GestHeader';

/**
 * Cuerpo técnico: hire (or upgrade) and dismiss the four technical-staff roles —
 * segundo entrenador, preparador físico, médico y ojeador. Each carries a level and
 * a salary and quietly makes an existing system work better. A pretemporada call, in
 * the spirit of the classic PC Fútbol: once the season kicks off, the staff is set.
 */
export function StaffScreen() {
  const career = useGameStore((s) => s.career);
  const hireStaffMember = useGameStore((s) => s.hireStaffMember);
  const fireStaffMember = useGameStore((s) => s.fireStaffMember);
  const marketMessage = useGameStore((s) => s.marketMessage);
  const goTo = useGameStore((s) => s.goTo);

  if (!career) {
    return (
      <main className="screen">
        <p>No hay carrera en curso.</p>
        <RetroButton onClick={() => goTo('title')}>Menú</RetroButton>
      </main>
    );
  }

  const staff = career.staff;
  const total = staffWageBill(staff);
  // Staff can only be managed in the pretemporada (before the first matchday), so a
  // late change never rewrites results already played.
  const editable = career.season.currentMatchday === 1;

  return (
    <main className="screen">
      <GestHeader
        icon="🧑‍🏫"
        title="Cuerpo técnico"
        subtitle={`Temporada ${career.temporada}`}
        chips={[
          { label: 'Presupuesto', value: formatEuros(career.budget) },
          { label: 'Salarios staff', value: `${formatEuros(total)}/año` },
        ]}
      />

      {!editable ? (
        <RetroPanel title="Temporada en curso">
          <p className="hint">
            El cuerpo técnico solo se gestiona en pretemporada. Podrás fichar o despedir la
            próxima temporada, antes de la primera jornada.
          </p>
        </RetroPanel>
      ) : null}

      {marketMessage ? <p className="market-message">{marketMessage}</p> : null}

      {STAFF_ROLES.map((role) => {
        const level = staffLevel(staff, role.role);
        const hired = level > 0;
        return (
          <RetroPanel key={role.role} title={role.label}>
            <p className="hint">{role.hint}</p>
            <p className="board-objective">
              {hired ? (
                <>
                  Contratado · Nivel {level}{' '}
                  <span className="hint">{formatEuros(staffSalary(role.role, level))}/año</span>
                </>
              ) : (
                <span className="hint">Vacante. El manager se apaña solo en esta faceta.</span>
              )}
            </p>
            <ul className="market-list">
              {staffOptions(role.role).map((opt) => {
                const on = opt.level === level;
                return (
                  <li
                    key={opt.level}
                    className={`market-row market-negotiate${on ? ' market-row--active' : ''}`}
                  >
                    <span className="market-name">
                      {on ? '➡️ ' : ''}
                      Nivel {opt.level}
                    </span>
                    <span className="hint">
                      {formatEuros(opt.salary)}/año · prima {formatEuros(opt.hireCost)}
                    </span>
                    <span className="market-offer">
                      <RetroButton
                        variant={on ? undefined : 'primary'}
                        disabled={!editable || on || career.budget < opt.hireCost}
                        onClick={() => hireStaffMember(role.role, opt.level)}
                      >
                        {on ? 'Contratado ✓' : hired ? 'Cambiar' : 'Contratar'}
                      </RetroButton>
                    </span>
                  </li>
                );
              })}
            </ul>
            {hired ? (
              <div className="season-actions">
                <RetroButton disabled={!editable} onClick={() => fireStaffMember(role.role)}>
                  Despedir
                </RetroButton>
              </div>
            ) : null}
          </RetroPanel>
        );
      })}

      <div className="season-actions">
        <RetroButton onClick={() => goTo('season')}>Volver a la liga</RetroButton>
      </div>
    </main>
  );
}

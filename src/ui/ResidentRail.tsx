import type { World } from '../engine/model';
import { resident, selectResident } from '../engine/HouseholdEngine';
import { residentWallet } from '../engine/WalletEngine';
import { mutate } from '../store';
import { Avatar } from './components';
export function ResidentRail({ world: w, onEdit }: { world: World; onEdit: () => void }) {
  return (
    <aside className="resident-rail" aria-label="主控人物头像">
      <span className="rail-title">家中成员</span>
      <div className="resident-portraits">
        {w.household.members.map((m) => {
          const person = resident(w, m.id)!;
          const selected = m.id === w.household.active;
          return (
            <button
              key={m.id}
              aria-label={`主控：${person.character.name}`}
              aria-pressed={selected}
              title={`${person.character.name} · ${residentWallet(w, m.id).label} ¥${residentWallet(w, m.id).balance.toFixed(2)}`}
              onClick={() => mutate((x) => selectResident(x, m.id))}
            >
              <Avatar world={person} />
              <span>{person.character.name}</span>
            </button>
          );
        })}
      </div>
      <button
        className="resident-edit"
        onClick={onEdit}
        aria-label={`编辑${w.character.name}的形象与性格`}
      >
        装扮
        <br />
        性格
      </button>
    </aside>
  );
}

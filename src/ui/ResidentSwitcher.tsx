import type { World } from '../engine/model';
import { resident, selectResident } from '../engine/HouseholdEngine';
import { residentWallet } from '../engine/WalletEngine';
import { mutate } from '../store';
export function ResidentSwitcher({ world: w }: { world: World }) {
  const wallet = residentWallet(w, w.household.active);
  const owners = wallet.members
    .map((id) => resident(w, id)?.character.name)
    .filter(Boolean)
    .join('、');
  return (
    <section className="resident-switcher" aria-label="当前人物与账户">
      <label>
        查看人物
        <select
          aria-label="查看人物"
          value={w.household.active}
          onChange={(e) => mutate((x) => selectResident(x, e.target.value))}
        >
          {w.household.members.map((m) => (
            <option key={m.id} value={m.id}>
              {resident(w, m.id)!.character.name}
            </option>
          ))}
        </select>
      </label>
      <div>
        <strong>
          {w.character.name}的{wallet.label} · ¥{wallet.balance.toFixed(2)}
        </strong>
        <small>
          {wallet.members.length > 1
            ? `共同持有人：${owners}`
            : '独立账户 · 室友的收入和消费不计入此账户'}
        </small>
        <small>当前资料、记忆、日记与经历均属于{w.character.name}。</small>
      </div>
    </section>
  );
}

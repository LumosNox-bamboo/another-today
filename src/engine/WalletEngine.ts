import { type World, dayKey, transact } from './model';

export function walletGroups(w: World) {
  const ids = w.household.members.map((m) => m.id);
  const age = (id: string) =>
    id === w.household.active
      ? w.character.age
      : w.household.members.find((m) => m.id === id)!.state!.character.age;
  const root = Object.fromEntries(ids.map((id) => [id, id]));
  const find = (id: string): string => (root[id] === id ? id : find(root[id]));
  // Only spouses join adult finances. A child cannot bridge two unmarried parents' accounts.
  for (const b of w.household.bonds) if (b.type === '夫妻') root[find(b.b)] = find(b.a);
  for (const id of ids.filter((id) => age(id) < 18)) {
    const parent = w.household.bonds.find((b) => b.type === '亲子' && b.b === id && age(b.a) >= 18);
    if (parent) root[id] = find(parent.a);
  }
  return [...new Set(ids.map(find))].map((r) => ids.filter((id) => find(id) === r));
}
export function syncWallet(w: World) {
  const current = w.household.wallets?.find((a) => a.members.includes(w.household.active));
  if (current) current.balance = w.money;
}
export function reconcileWallets(w: World) {
  const sets = walletGroups(w);
  if (!sets.length) return;
  const before = w.household.wallets;
  syncWallet(w);
  const next = sets.map((members) => ({ members, balance: 0 }));
  if (!before) {
    // Old shared money has no reliable owner history. Preserve every cent, once.
    const cents = Math.round(w.money * 100),
      each = Math.floor(cents / next.length);
    next.forEach((a, i) => (a.balance = (each + (i < cents % next.length ? 1 : 0)) / 100));
    if (next.length > 1)
      w.household.financeMigration =
        '旧版共享存款已按独立钱包均分，总额保持不变。旧账单保留为迁移前记录。';
  } else {
    for (const old of before) {
      const parts = next.filter((a) => a.members.some((id) => old.members.includes(id)));
      const cents = Math.round(old.balance * 100),
        each = Math.floor(cents / parts.length);
      parts.forEach((a, i) => (a.balance += (each + (i < cents % parts.length ? 1 : 0)) / 100));
    }
  }
  for (const a of next) a.balance = Math.round(a.balance * 100) / 100;
  w.household.wallets = next;
  w.money = next.find((a) => a.members.includes(w.household.active))!.balance;
}
export function walletMembers(w: World) {
  return (
    w.household.wallets?.find((a) => a.members.includes(w.household.active))?.members || [
      w.household.active,
    ]
  );
}
export function walletLabel(w: World) {
  return walletMembers(w).length > 1 ? '核心家庭存款' : '个人存款';
}
export function chargeRent(w: World, select: (w: World, id: string) => void) {
  const date = dayKey(w.time);
  if (w.lastRentDay === date) return;
  const selected = w.household.active;
  const total = w.character.housing === '合租小屋' ? 18 : 30;
  const wallets = w.household.wallets!;
  let remaining = total;
  wallets.forEach((a, i) => {
    const share =
      i === wallets.length - 1
        ? remaining
        : Math.round(((total * a.members.length) / w.household.members.length) * 100) / 100;
    remaining = Math.round((remaining - share) * 100) / 100;
    select(w, a.members[0]);
    transact(w, -Math.min(w.money, share), '每日住房与公共开支');
  });
  select(w, selected);
  w.lastRentDay = date;
}

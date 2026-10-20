import { type World, type Trait, random, transact, record, dayKey } from './model';
import { walletMembers } from './WalletEngine';

type Purchase = 'eat' | 'coffee' | 'shop';
interface Option {
  label: string;
  range: [number, number];
  trait: Trait;
  text: string;
}
const options: Record<Purchase, Option[]> = {
  eat: [
    {
      label: '简单的一餐',
      range: [5, 8],
      trait: 'discipline',
      text: '选了一份简单合口味的饭，吃饱就好。',
    },
    {
      label: '换一种口味',
      range: [9, 13],
      trait: 'curiosity',
      text: '这顿饭换了平时少吃的口味，给普通的一餐添点变化。',
    },
    {
      label: '认真吃顿喜欢的饭',
      range: [14, 20],
      trait: 'romance',
      text: '在预算内挑了喜欢的搭配，坐下来慢慢吃完。',
    },
  ],
  coffee: [
    {
      label: '基础款饮品',
      range: [7, 10],
      trait: 'discipline',
      text: '看过价格，选了熟悉的基础款。',
    },
    {
      label: '试试不同风味',
      range: [11, 16],
      trait: 'openness',
      text: '选了一种平时少点的风味，想尝尝有什么不同。',
    },
    {
      label: '特别搭配饮品',
      range: [17, 23],
      trait: 'romance',
      text: '留了一点预算给喜欢的特别搭配，今天慢慢喝。',
    },
  ],
  shop: [
    {
      label: '按清单补日用品',
      range: [10, 15],
      trait: 'discipline',
      text: '对照需要补的东西，只选了清单上的日用品。',
    },
    {
      label: '比较不同款日用品',
      range: [16, 22],
      trait: 'curiosity',
      text: '比较了几种日用品，选了想试试的新款。',
    },
    {
      label: '日用品与顺手的小零食',
      range: [23, 32],
      trait: 'adventure',
      text: '补好日用品后，在预算内顺手多选了一份小零食。',
    },
  ],
};

// Optional purchases share a daily allowance within a core-family wallet.
// Roommates keep their own allowance; food is never blocked by this limit.
export function optionalSpendingBudget(w: World) {
  const members = walletMembers(w),
    date = dayKey(w.time);
  const spent = w.ledger
    .filter(
      (l) =>
        l.amount < 0 &&
        l.reason.startsWith('日常消费 · ') &&
        !l.reason.startsWith('日常消费 · 吃饭') &&
        l.payerId &&
        members.includes(l.payerId) &&
        dayKey(l.time) === date,
    )
    .reduce((sum, l) => sum - l.amount, 0);
  return Math.max(0, Math.min(45 - spent, w.money - 60));
}

export function spendOnActivity(w: World, kind: Purchase) {
  const budget = kind === 'eat' ? w.money : optionalSpendingBudget(w);
  // Tight funds favour inexpensive meals rather than random large expenses.
  const cap = kind === 'eat' && w.money < 100 ? Math.min(8, budget) : budget;
  const available = options[kind].filter((o) => o.range[0] <= cap);
  if (!available.length) {
    if (kind === 'eat') {
      const cost = Math.min(5, w.money);
      if (cost > 0) transact(w, -cost, '日常消费 · 吃饭 · 按现有预算安排');
      record(
        w,
        '简单解决一餐',
        `按现有食物和预算安排了一餐，本次支出 ¥${cost.toFixed(2)}。`,
        '日常消费',
        false,
        'spending-eat-budget',
      );
    } else {
      record(
        w,
        '今天不额外消费',
        kind === 'coffee'
          ? '看了看手头预算，没有点饮品，休息了一会儿。'
          : '看过用品和预算，决定暂时不买。',
        '日常消费',
        false,
        `spending-${kind}-skip`,
      );
    }
    return;
  }
  const weights = available.map((o) => 0.35 + 2.5 * (w.character.traits[o.trait] / 100) ** 2);
  let pick = random(w) * weights.reduce((a, b) => a + b, 0);
  const option =
    available.find((_, i) => (pick -= weights[i]) <= 0) || available[available.length - 1];
  const max = Math.min(option.range[1], Math.floor(cap));
  const cost = option.range[0] + Math.floor(random(w) * (max - option.range[0] + 1));
  const label = kind === 'eat' ? '吃饭' : kind === 'coffee' ? '饮品' : '日用品';
  transact(w, -cost, `日常消费 · ${label} · ${option.label}`);
  record(
    w,
    option.label,
    `${option.text} 本次花了 ¥${cost}。`,
    '日常消费',
    false,
    `spending-${kind}`,
  );
}

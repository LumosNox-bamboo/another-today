import { useState } from 'react';
import type { World } from '../engine/model';
import { editAppearance } from '../engine/HouseholdEngine';
import { mutate } from '../store';
import { Avatar } from './components';
import { PersonalityEditor } from './Household';
export function CharacterEditor({ world: w }: { world: World }) {
  const [look, setLook] = useState({
    hair: w.character.hair,
    skin: w.character.skin,
    outfit: w.character.outfit,
  });
  const [saved, setSaved] = useState(false);
  return (
    <section className="card character-editor" aria-label={`${w.character.name}的形象与性格`}>
      <h2>装扮与性格 · {w.character.name}</h2>
      <p>只改变这位人物，已有记忆、关系和技能会保留。</p>
      <div className="appearance-controls">
        <Avatar world={{ character: { ...w.character, ...look } }} size="large" />
        {(
          [
            ['hair', '发色'],
            ['skin', '肤色'],
            ['outfit', '日常衣服颜色'],
          ] as const
        ).map(([key, label]) => (
          <label key={key}>
            {label}
            <input
              type="color"
              aria-label={label}
              value={look[key]}
              onChange={(e) => {
                setLook({ ...look, [key]: e.target.value });
                setSaved(false);
              }}
            />
          </label>
        ))}
        <button
          onClick={() => {
            mutate((x) => editAppearance(x, look));
            setSaved(true);
          }}
        >
          保存形象
        </button>
      </div>
      {saved && <p role="status">形象已保存，头像和场景中的人物会一起更新。</p>}
      <PersonalityEditor world={w} />
    </section>
  );
}

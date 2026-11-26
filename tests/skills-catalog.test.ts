import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

interface Skill {
  id: string;
  name: string;
  category: string;
  icon: string;
  level: string;
  description: string;
}

const raw: unknown = JSON.parse(
  readFileSync(join(process.cwd(), 'public', 'data', 'skills.json'), 'utf8'),
);
const skills = (raw as { skills: Skill[] }).skills;

describe('public/data/skills.json', () => {
  it('contains a non-empty skills array', () => {
    expect(Array.isArray(skills)).toBe(true);
    expect(skills.length).toBeGreaterThan(0);
  });

  it('has all required non-empty string fields', () => {
    for (const skill of skills) {
      for (const key of ['id', 'name', 'category', 'icon', 'level', 'description'] as const) {
        expect(typeof skill[key], `${skill.id}.${key}`).toBe('string');
        expect(skill[key].trim(), `${skill.id}.${key}`).not.toBe('');
      }
      expect(skill.id).toMatch(/^[a-z0-9-]+$/);
    }
  });

  it('has unique ids and names', () => {
    const ids = skills.map((s) => s.id);
    const names = skills.map((s) => s.name.trim().toLowerCase());
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe('public/legacy-app.html', () => {
  const html = readFileSync(join(process.cwd(), 'public', 'legacy-app.html'), 'utf8');

  it('has no stray CJK characters', () => {
    expect(html).not.toMatch(/[\u3000-\u9fff\uac00-\ud7af]/);
  });

  it('defines every function used by inline handlers', () => {
    const handlers = new Set([...html.matchAll(/\bon\w+="(\w+)\(/g)].map((m) => m[1]));
    const defined = new Set([...html.matchAll(/function (\w+)/g)].map((m) => m[1]));
    for (const name of handlers) expect(defined.has(name as string), name).toBe(true);
  });

  it('limits school grades per subject', () => {
    const body = html.match(/const SCHOOL_GRADES=\{([^}]*)\}/)?.[1] ?? '';
    const ranges = Object.fromEntries(
      [...body.matchAll(/(\w+):\[(\d+),(\d+)\]/g)].map((m) => [m[1], [Number(m[2]), Number(m[3])]]),
    );
    expect(ranges).toEqual({
      math: [1, 6],
      algebra: [7, 11],
      geometry: [7, 11],
      probstat: [7, 11],
      physics: [7, 11],
      chemistry: [8, 11],
      civics: [9, 11],
      geography: [5, 11],
      biology: [5, 11],
      history: [5, 11],
    });
    for (const id of Object.keys(ranges)) expect(html, id).toContain(`{id:'${id}',name:`);
  });

  it('has local banner files for every theme', () => {
    const themes = [...html.matchAll(/\['(\w+)',\//g)].map((m) => m[1]);
    expect(themes.length).toBeGreaterThan(20);
    for (const name of [...themes, 'default']) {
      const file = name === 'history' ? 'history.jpg' : `t-${name}.svg`;
      expect(existsSync(join(process.cwd(), 'public', 'images', file)), file).toBe(true);
    }
  });
});

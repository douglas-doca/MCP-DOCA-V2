// src/mock/generator/utils/faker.ts
import { pick, randInt } from "./rand";

const FIRST_NAMES = [
  "Lucas",
  "Mariana",
  "Fernanda",
  "João",
  "Ana",
  "Rafael",
  "Beatriz",
  "Camila",
  "Pedro",
  "Bruna",
  "Thiago",
  "Juliana",
  "Gustavo",
  "Paula",
  "Felipe",
  "Larissa",
  "Renato",
  "Aline",
];

const LAST_NAMES = [
  "Silva",
  "Souza",
  "Oliveira",
  "Santos",
  "Lima",
  "Costa",
  "Pereira",
  "Ferreira",
  "Almeida",
  "Carvalho",
  "Gomes",
  "Ribeiro",
  "Martins",
];

export function fakeName() {
  return `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
}

export function fakePhoneBR() {
  const ddd = pick([11, 19, 21, 27, 31, 41, 47, 51, 61, 71, 81, 85]);
  const n1 = randInt(90000, 99999);
  const n2 = randInt(1000, 9999);
  return `55${ddd}9${n1}${n2}`;
}

export function fakeCompany(niche: string) {
  const base = {
    clinic: ["Clínica", "Centro", "Instituto", "Espaço"],
    realestate: ["Imobiliária", "Consultoria", "Grupo", "House"],
    aesthetics: ["Studio", "Espaço", "Clínica", "Boutique"],
    law: ["Advocacia", "Sociedade", "Consultoria", "Escritório"],
    ecommerce: ["Store", "Shop", "Outlet", "Marketplace"],
  } as Record<string, string[]>;

  const suffix = {
    clinic: ["Capilar", "Saúde", "Dermato", "Bem-estar"],
    realestate: ["Prime", "Urbano", "Imóveis", "Invest"],
    aesthetics: ["Beauty", "Skin", "Glow", "Estética"],
    law: ["Legal", "Jurídico", "Direito", "Partners"],
    ecommerce: ["Online", "Brasil", "Express", "Premium"],
  } as Record<string, string[]>;

  const b = pick(base[niche] || ["DOCA"]);
  const s = pick(suffix[niche] || ["Performance"]);
  return `${b} ${s}`;
}

export function isoAgo(minutesAgo: number) {
  const d = new Date(Date.now() - minutesAgo * 60000);
  return d.toISOString();
}

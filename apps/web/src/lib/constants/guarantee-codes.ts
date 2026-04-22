import type { DictionaryKey } from "@/lib/i18n/locales/en";

export type GuaranteeCode = {
  code: string;
  labelKey: DictionaryKey;
  descKey: DictionaryKey;
};

export const GUARANTEE_CODES: readonly GuaranteeCode[] = [
  {
    code: "cc_guaranteed",
    labelKey: "gc.cc.label",
    descKey: "gc.cc.desc",
  },
  {
    code: "company_guaranteed",
    labelKey: "gc.co.label",
    descKey: "gc.co.desc",
  },
  {
    code: "deposit_guaranteed",
    labelKey: "gc.dep.label",
    descKey: "gc.dep.desc",
  },
  {
    code: "non_guaranteed",
    labelKey: "gc.ng.label",
    descKey: "gc.ng.desc",
  },
  {
    code: "travel_agent_guaranteed",
    labelKey: "gc.ta.label",
    descKey: "gc.ta.desc",
  },
] as const;

export const GUARANTEE_CODE_VALUES = GUARANTEE_CODES.map((g) => g.code);

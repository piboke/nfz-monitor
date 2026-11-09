export interface QueueRow {
  id: string;
  facilityId: string;
  province: string;
  case: number;
  benefitId: string;
  benefit: string;
  providerCode: string;
  provider: string;
  place: string;
  address: string;
  locality: string;
  county: string;
  phone: string | null;
  email: string | null;
  website: string | null;
  latitude: number | null;
  longitude: number | null;
  forChildren: boolean | null;
  ageRange: string | null;
  benefitCode: string | null;
  pcus: string | null;
  pcusDays: number | null;
  pcusApplicable: boolean;
  pcusUpdatedAt: string | null;
  awaiting: number | null;
  removed: number | null;
  averageDays: number | null;
  computedAverageDays: number | null;
  reportingPeriod: string | null;
  computedPeriod: string | null;
}
export interface HistoryPoint {
  id: string;
  facilityId: string;
  benefitId: string;
  case: number;
  province: string;
  reportingPeriod: string | null;
  pcusUpdatedAt: string | null;
  awaiting: number | null;
  removed: number | null;
  pcusDays: number | null;
  pcus: string | null;
  retrievedAt: string;
}
export interface Aggregate {
  key: string;
  queues: number;
  knownAwaiting: number;
  awaitingEntries: number | null;
  knownPcus: number;
  medianPcusDays: number | null;
  freshQueues: number;
  freshPercent: number;
  matchedQueues: number;
  awaitingChange: number | null;
  awaitingChangePercent: number | null;
  medianPcusChange: number | null;
  risingQueues: number;
  fallingQueues: number;
}
export interface Shard {
  province: string;
  case: number;
  benefitId: string;
  benefit: string;
  path: string;
  historyPath: string;
  count: number;
  bytes: number;
}
export interface Manifest {
  schemaVersion: string;
  lastSync: string | null;
  complete: boolean;
  national: boolean;
  source: string;
  scope: string;
  periods: string[];
  regions: string[];
  shards: Shard[];
  warnings: string[];
  queueCount: number;
  providerCount?: number;
  facilityCount?: number;
  generation: string;
}
export interface Summary {
  total: Aggregate;
  regions: Aggregate[];
  shards: Aggregate[];
  qualityCounts: Record<string, number>;
}
export const REGIONS: Record<string, string> = {
  "01": "dolnośląskie",
  "02": "kujawsko-pomorskie",
  "03": "lubelskie",
  "04": "lubuskie",
  "05": "łódzkie",
  "06": "małopolskie",
  "07": "mazowieckie",
  "08": "opolskie",
  "09": "podkarpackie",
  "10": "podlaskie",
  "11": "pomorskie",
  "12": "śląskie",
  "13": "świętokrzyskie",
  "14": "warmińsko-mazurskie",
  "15": "wielkopolskie",
  "16": "zachodniopomorskie",
};
export interface Filters {
  benefit: string;
  province: string;
  category: string;
  county: string;
  locality: string;
  provider: string;
  age: string;
  min: string;
  max: string;
  queue: string;
}
export const EMPTY_FILTERS: Filters = {
  benefit: "",
  province: "",
  category: "1",
  county: "",
  locality: "",
  provider: "",
  age: "",
  min: "",
  max: "",
  queue: "",
};

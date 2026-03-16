export interface FplBootstrapStaticResponse {
  teams: Array<{
    id: number;
    name: string;
    short_name: string;
    strength_attack_home: number;
    strength_defence_home: number;
  }>;
  elements: Array<{
    id: number;
    team: number;
    first_name: string;
    second_name: string;
    web_name: string;
    element_type: number;
    now_cost: number;
    selected_by_percent: string;
    status: string;
    minutes: number;
    form: string;
  }>;
  events: Array<{
    id: number;
    deadline_time: string;
    is_current: boolean;
    finished: boolean;
  }>;
}

export interface FplFixtureResponseItem {
  id: number;
  event: number | null;
  team_h: number;
  team_a: number;
  kickoff_time: string | null;
  team_h_difficulty: number;
  team_a_difficulty: number;
  finished: boolean;
}

export interface FplElementSummaryResponse {
  history: Array<{
    fixture: number;
    minutes: number;
    goals_scored: number;
    assists: number;
    clean_sheets: number;
    expected_goals: string;
    expected_assists: string;
    yellow_cards: number;
    red_cards: number;
    saves: number;
    bonus: number;
    total_points: number;
  }>;
}

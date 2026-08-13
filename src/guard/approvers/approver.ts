import { Action } from "../../action/types";

export interface Approver {
  approve(action: Action): Promise<{ approved: boolean; reason?: string }>;
}
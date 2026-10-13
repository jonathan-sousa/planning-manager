/** Cost allocation and inventory tags of a stage ('shared' for the mail stack). */
export function stageTags(stage: string): Record<string, string> {
  return { Project: 'planning-manager', Stage: stage };
}

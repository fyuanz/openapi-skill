export interface OutputPublicationResult {
  skillDirectory: string;
  status: 'success' | 'failed';
  error?: unknown;
}

export class MultiOutputPublishError extends Error {
  readonly results: readonly OutputPublicationResult[];

  constructor(results: readonly OutputPublicationResult[]) {
    const causes = results.flatMap((result) => result.status === 'failed' ? [result.error] : []);
    super('PUBLISH: one or more output targets failed', {
      cause: new AggregateError(causes, 'one or more output targets failed')
    });
    this.name = 'MultiOutputPublishError';
    this.results = results;
  }
}

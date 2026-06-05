import { Request, Response } from 'express';

/**
 * Health check endpoint returning status.
 */
export function getHealth(req: Request, res: Response) {
  res.status(200).json({
    status: 'UP'
  });
}

/**
 * Candidate evaluation metadata endpoint.
 */
export function getEvaluation(req: Request, res: Response) {
  res.status(200).json({
    candidateName: process.env.CANDIDATE_NAME || 'John Doe',
    email: process.env.CANDIDATE_EMAIL || 'john@example.com',
    repositoryUrl: process.env.REPOSITORY_URL || 'https://github.com/galaxy-grid/hintro-assignment',
    deployedUrl: process.env.DEPLOYED_URL || 'https://hintro-meeting-intelligence.up.railway.app',
    externalIntegration: 'Resend',
    features: [
      'Authentication',
      'AI Analysis',
      'Reminder Scheduler'
    ]
  });
}

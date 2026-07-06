// lib/logger.js - Helper untuk mencatat Log Aktivitas (Audit Trail)
import prisma from './db'

export async function logActivity({ action, description, details = null, memberId = null }) {
  try {
    await prisma.activityLog.create({
      data: {
        action,
        description,
        details: details ? (typeof details === 'string' ? details : JSON.stringify(details)) : null,
        memberId,
      },
    })
  } catch (error) {
    console.error('Failed to log activity:', error)
  }
}

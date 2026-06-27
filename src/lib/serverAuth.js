import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../pages/api/auth/[...nextauth]'

/**
 * Returns true if the request has a valid Google OAuth session.
 * @param {import('next').NextApiRequest} req
 * @param {import('next').NextApiResponse} res
 * @returns {Promise<boolean>}
 */
export async function isAuthenticated(req, res) {
  const session = await getServerSession(req, res, authOptions)
  return !!session
}

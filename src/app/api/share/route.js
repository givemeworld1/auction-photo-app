import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import crypto from 'crypto';

export async function POST(request) {
  try {
    const { folderId } = await request.json();

    if (!folderId) {
      return NextResponse.json({ error: 'Missing folderId' }, { status: 400 });
    }

    // Check if share link already exists
    let existing = await query(
      'SELECT share_token FROM shared_links WHERE folder_id = $1 LIMIT 1',
      [folderId]
    );

    if (existing.rows.length > 0) {
      return NextResponse.json({ shareToken: existing.rows[0].share_token });
    }

    // Generate token
    const token = crypto.randomBytes(12).toString('hex');

    await query(
      'INSERT INTO shared_links (share_token, folder_id) VALUES ($1, $2)',
      [token, folderId]
    );

    return NextResponse.json({ shareToken: token });
  } catch (error) {
    console.error('Share error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

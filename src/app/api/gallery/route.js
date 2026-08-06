import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
  try {
    // Retrieve folders along with their photo count and latest photo thumbnail
    const result = await query(`
      SELECT 
        f.id,
        f.lot_number,
        f.created_at,
        COUNT(p.id)::int AS photo_count,
        MAX(p.cloudinary_url) AS cover_url
      FROM folders f
      LEFT JOIN photos p ON p.folder_id = f.id
      GROUP BY f.id
      ORDER BY f.created_at DESC
    `);

    return NextResponse.json({ folders: result.rows });
  } catch (error) {
    console.error('Gallery fetch error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function POST(request) {
  try {
    const { lotNumber, cloudinaryUrl, publicId } = await request.json();

    if (!lotNumber || !cloudinaryUrl) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    // 1. Find or create folder for this lot number
    let folderRes = await query(
      'SELECT id FROM folders WHERE lot_number = $1 LIMIT 1',
      [lotNumber]
    );

    let folderId;
    if (folderRes.rows.length === 0) {
      const newFolder = await query(
        'INSERT INTO folders (lot_number) VALUES ($1) RETURNING id',
        [lotNumber]
      );
      folderId = newFolder.rows[0].id;
    } else {
      folderId = folderRes.rows[0].id;
    }

    // 2. Insert photo record connected to folder
    const photoRes = await query(
      'INSERT INTO photos (folder_id, cloudinary_url, public_id) VALUES ($1, $2, $3) RETURNING id',
      [folderId, cloudinaryUrl, publicId || '']
    );

    return NextResponse.json({
      success: true,
      photoId: photoRes.rows[0].id,
      folderId: folderId
    });
  } catch (error) {
    console.error('Photo upload DB error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

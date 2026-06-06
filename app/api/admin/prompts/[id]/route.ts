import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

type RouteParams = {
  params: Promise<{ id: string }>;
};

// DELETE - Delete a prompt
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;

    const { error } = await supabase
      .from('prompts')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Supabase delete error:', error);
      return NextResponse.json(
        { error: 'Failed to delete prompt from database' },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Prompt deleted successfully' 
    });
  } catch (error) {
    console.error('Delete error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
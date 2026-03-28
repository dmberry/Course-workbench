import { NextRequest, NextResponse } from "next/server";
import { getInstitutionProfile, listInstitutionProfiles } from "@/lib/institutions/profile";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const summary = searchParams.get("summary");
    const profileId = searchParams.get("id") || "default";

    if (summary === "1" || summary === "true") {
      return NextResponse.json({ ok: true, profiles: listInstitutionProfiles() });
    }

    return NextResponse.json({
      ok: true,
      profile: getInstitutionProfile(profileId),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown institution profile error",
      },
      { status: 500 }
    );
  }
}

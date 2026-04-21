"use client";

import { use } from "react";
import { redirect } from "next/navigation";

export default function CandidateDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  redirect(`/candidate/${id}`);
}

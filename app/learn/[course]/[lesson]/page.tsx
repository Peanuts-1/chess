import { notFound } from "next/navigation";
import LessonPlayer from "@/components/LessonPlayer";
import { COURSES, findCourse } from "@/lib/curriculum";

export const generateStaticParams = () => COURSES.flatMap((c) => c.lessons.map((l) => ({ course: c.id, lesson: l.id })));

export default function LessonPage({ params }: { params: { course: string; lesson: string } }) {
  const c = findCourse(params.course);
  const l = c?.lessons.find((x) => x.id === params.lesson);
  if (!c || !l) notFound();
  return <LessonPlayer courseId={c.id} lessonId={l.id} />;
}

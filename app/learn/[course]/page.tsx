import { notFound } from "next/navigation";
import CourseView from "@/components/CourseView";
import { COURSES, findCourse } from "@/lib/curriculum";

export const generateStaticParams = () => COURSES.map((c) => ({ course: c.id }));

export default function CoursePage({ params }: { params: { course: string } }) {
  const c = findCourse(params.course);
  if (!c) notFound();
  return <CourseView courseId={c.id} />;
}

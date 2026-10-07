"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import {
  ArrowDown,
  ArrowRight,
  BookOpen,
  Check,
  ChevronDown,
  GraduationCap,
  LockKeyhole,
  Menu,
  Pause,
  Play,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import {
  calculateStats,
  calculateTermStats,
  CourseAttempt,
  GRADE_POINTS,
  reconcileRepeats,
  solveTargetCgpa,
} from "@/domain/transcript";

type Props = {
  attempts: CourseAttempt[];
  onDemo: () => void;
  onFile: (file: File) => void;
  progress: string;
  error: string;
};
const tabs = ["Your grades", "Your next goal", "Your semester"] as const;
const semesterCourses = [
  "Machine Learning",
  "Database Systems",
  "Applied Statistics",
  "Technical Communication",
];

function Brand() {
  return (
    <a className="sb-brand" href="#top" aria-label="Transcriptify home">
      <span className="sb-brand-mark">
        <BookOpen size={23} />
      </span>
      <span>
        transcriptify<span className="sb-brand-dot">.</span>
      </span>
    </a>
  );
}

export function ScrapbookLanding({
  attempts,
  onDemo,
  onFile,
  progress,
  error,
}: Props) {
  const [paused, setPaused] = useState(false);
  const [menu, setMenu] = useState(false);
  const [tab, setTab] = useState<(typeof tabs)[number]>("Your grades");
  const [grades, setGrades] = useState<Record<string, string>>({});
  const [goal, setGoal] = useState(3.7);
  const [credits, setCredits] = useState(30);
  const [courses, setCourses] = useState<string[]>(semesterCourses.slice(0, 3));
  const file = useRef<HTMLInputElement>(null);
  const adjusted = reconcileRepeats(
    attempts.map((a) => {
      const grade = grades[a.id] ?? a.grade;
      const gradePoints = GRADE_POINTS[grade] ?? 0;
      return { ...a, grade, gradePoints, points: gradePoints * a.credits };
    }),
  );
  const stats = calculateStats(adjusted);
  const target = solveTargetCgpa(stats, goal, credits);

  return (
    <div className={`scrapbook ${paused ? "sb-paused" : ""}`} id="top">
      <a className="sb-skip" href="#sb-main">
        Skip to content
      </a>
      <header className="sb-header">
        <Brand />
        <nav aria-label="Main navigation" className={menu ? "sb-nav-open" : ""}>
          {[
            ["The little demo", "live-demo"],
            ["How it works", "how-it-works"],
            ["Your privacy", "your-privacy"],
          ].map(([label, id]) => (
            <a href={`#${id}`} key={id} onClick={() => setMenu(false)}>
              {label}
            </a>
          ))}
        </nav>
        <a className="sb-button sb-button-small" href="#import">
          Open your notebook <ArrowRight size={16} />
        </a>
        <button
          className="sb-menu"
          aria-label={menu ? "Close navigation" : "Open navigation"}
          aria-expanded={menu}
          onClick={() => setMenu(!menu)}
        >
          {menu ? <X /> : <Menu />}
        </button>
      </header>
      <main id="sb-main">
        <section className="sb-hero">
          <div className="sb-hero-grid sb-container">
            <div className="sb-hero-copy">
              <p className="sb-kicker">
                <span className="sb-dot" /> A LITTLE CLARITY FOR YOUR UNIVERSITY
                YEARS
              </p>
              <h1>
                Your grades.
                <br />
                Your goals.
                <br />
                <span className="sb-cutout">
                  <span>Your</span> <span>next</span> <span>chapter.</span>
                </span>
              </h1>
              <p className="sb-hero-lede">
                There’s a bigger picture in that transcript.
                <br />
                Let’s turn it into a plan you can actually see.
              </p>
              <div className="sb-hero-actions">
                <a className="sb-button" href="#import">
                  Make sense of my transcript <ArrowRight size={18} />
                </a>
                <a className="sb-text-link" href="#live-demo">
                  Try it first <ArrowDown size={17} />
                </a>
              </div>
              <p className="sb-hero-trust">
                <LockKeyhole size={14} /> Stays in your browser. No account
                needed.
              </p>
            </div>
            <div
              className="sb-collage"
              aria-label="A scrapbook of sample academic progress"
            >
              <Image
                className="sb-generated-notebook"
                src="/artwork/scrapbook-notebook.png"
                alt=""
                width={1280}
                height={1280}
                sizes="(max-width: 700px) 90vw, 45vw"
                priority
              />
              <div className="sb-transcript-scrap" aria-hidden="true">
                <span>ACADEMIC TRANSCRIPT</span>
                <hr />
                COMM 1010 <b>B+</b>
                <hr />
                INFS 1101 <b>A</b>
                <hr />
                MATH 1030 <b>B+</b>
                <hr />
                INFS 2201 <b>A</b>
                <hr />
                <small>more than a list of letters.</small>
              </div>
              <div className="sb-polaroid">
                <span className="sb-tape" />
                <div className="sb-photo-board">
                  <div className="sb-photo-top">
                    <span>MY ACADEMIC STORY</span>
                    <Sparkles size={18} />
                  </div>
                  <small>CUMULATIVE GPA</small>
                  <strong>
                    {calculateStats(attempts).cgpa.toFixed(2)}
                    <span>/ 4.00</span>
                  </strong>
                  <div
                    className="sb-mini-chart"
                    aria-label="Sample term GPA trend"
                  >
                    {calculateTermStats(attempts).map((term, i) => (
                      <div key={i}>
                        <span>{term.cgpa.toFixed(2)}</span>
                        <i style={{ height: `${term.cgpa * 27}px` }} />
                        <small>{["F24", "W25", "F25", "W26"][i]}</small>
                      </div>
                    ))}
                  </div>
                  <span className="sb-photo-foot">
                    <Check size={13} /> Every semester tells a story.
                  </span>
                </div>
                <p>look how far you’ve come ♡</p>
              </div>
              <div className="sb-sticky sb-hero-sticky">
                <span className="sb-tape" />
                <span>note to self:</span>
                <p>
                  A grade is a moment.
                  <br />A plan is a possibility.
                </p>
                <span className="sb-hand-star" aria-hidden="true">
                  ✳
                </span>
              </div>
              <div className="sb-sticker">
                <GraduationCap size={27} />
                <span>
                  future
                  <br />
                  graduate
                </span>
              </div>
              <span className="sb-chalk-arrow" aria-hidden="true">
                ⤴
              </span>
            </div>
          </div>
          <div className="sb-hero-bottom sb-container">
            <a href="#live-demo">
              <ArrowDown size={16} /> SCROLL TO TURN THE PAGE
            </a>
            <span>Made for UDST students, with a little heart.</span>
            <button aria-pressed={paused} onClick={() => setPaused(!paused)}>
              {paused ? <Play size={13} /> : <Pause size={13} />}
              {paused ? "Resume motion" : "Pause motion"}
            </button>
          </div>
        </section>
        <div className="sb-paper-ribbon">
          <span>less guessing</span>
          <span aria-hidden="true">✳</span>
          <span>more possibility</span>
          <span aria-hidden="true">✳</span>
          <span>your story, in perspective</span>
          <span aria-hidden="true">✳</span>
          <span>one semester at a time</span>
        </div>
        <section
          className="sb-demo-section sb-container sb-reveal"
          id="live-demo"
        >
          <div className="sb-section-heading">
            <div>
              <p className="sb-kicker">01 / PLAY WITH THE POSSIBILITIES</p>
              <h2>
                A little “what if”
                <br />
                <em>goes a long way.</em>
              </h2>
            </div>
            <div className="sb-heading-note">
              No PDF? No problem.
              <br />
              Borrow our sample notebook.<span aria-hidden="true">↙</span>
            </div>
          </div>
          <div className="sb-notebook">
            <div className="sb-notebook-binding" aria-hidden="true" />
            <div className="sb-demo-toolbar">
              <span>
                <span className="sb-dot" /> LIVE DEMO · SYNTHETIC DATA
              </span>
              <button
                onClick={() => {
                  setGrades({});
                  setGoal(3.7);
                  setCredits(30);
                  setCourses(semesterCourses.slice(0, 3));
                }}
              >
                <RotateCcw size={13} /> Reset notebook
              </button>
            </div>
            <div
              className="sb-demo-tabs"
              role="tablist"
              aria-label="Explore Transcriptify"
            >
              {tabs.map((t, i) => (
                <button
                  key={t}
                  id={`demo-tab-${i}`}
                  role="tab"
                  aria-selected={tab === t}
                  tabIndex={tab === t ? 0 : -1}
                  onKeyDown={(e) => {
                    const next =
                      e.key === "ArrowRight"
                        ? (i + 1) % tabs.length
                        : e.key === "ArrowLeft"
                          ? (i + tabs.length - 1) % tabs.length
                          : e.key === "Home"
                            ? 0
                            : e.key === "End"
                              ? tabs.length - 1
                              : -1;
                    if (next >= 0) {
                      e.preventDefault();
                      setTab(tabs[next]);
                      document.getElementById(`demo-tab-${next}`)?.focus();
                    }
                  }}
                  aria-controls="demo-panel"
                  onClick={() => setTab(t)}
                  className={tab === t ? "active" : ""}
                >
                  <span>0{i + 1}</span> {t}
                </button>
              ))}
            </div>
            <div
              className="sb-demo-content"
              id="demo-panel"
              role="tabpanel"
              aria-labelledby={`demo-tab-${tabs.indexOf(tab)}`}
            >
              <div className="sb-demo-page">
                {tab === "Your grades" && (
                  <>
                    <h3>Change a grade. See the bigger picture.</h3>
                    <p>
                      Try a different result. The CGPA recalculates instantly,
                      including the higher repeated attempt.
                    </p>
                    <div className="sb-demo-courses">
                      {adjusted.map((a) => (
                        <label key={a.id}>
                          <span>
                            <strong>{a.title}</strong>
                            <small>
                              {a.term} · {a.credits} credits
                              {!a.includedInGpa
                                ? " · lower repeat excluded"
                                : ""}
                            </small>
                          </span>
                          <select
                            aria-label={`${a.title} ${a.term} sample grade`}
                            value={a.grade}
                            onChange={(e) =>
                              setGrades({ ...grades, [a.id]: e.target.value })
                            }
                          >
                            {["A", "B+", "B", "C+", "C", "D+", "D", "F"].map(
                              (g) => (
                                <option key={g}>{g}</option>
                              ),
                            )}
                          </select>
                        </label>
                      ))}
                    </div>
                  </>
                )}
                {tab === "Your next goal" && (
                  <>
                    <h3>A goal, with a way to get there.</h3>
                    <p>
                      Explore the average you would need in future courses using
                      your sample record.
                    </p>
                    <label className="sb-slider-label" htmlFor="sb-goal">
                      Target CGPA <strong>{goal.toFixed(2)}</strong>
                    </label>
                    <input
                      id="sb-goal"
                      type="range"
                      min="2"
                      max="4"
                      step="0.05"
                      value={goal}
                      onChange={(e) => setGoal(Number(e.target.value))}
                    />
                    <div className="sb-range-ends">
                      <span>2.00</span>
                      <span>4.00</span>
                    </div>
                    <label className="sb-slider-label" htmlFor="sb-credits">
                      Future GPA credits <strong>{credits}</strong>
                    </label>
                    <input
                      id="sb-credits"
                      type="range"
                      min="3"
                      max="120"
                      step="3"
                      value={credits}
                      onChange={(e) => setCredits(Number(e.target.value))}
                    />
                    <div className="sb-range-ends">
                      <span>3 credits</span>
                      <span>120 credits</span>
                    </div>
                    <p className="sb-demo-disclaimer">
                      An estimate based on future GPA credits. Repeats, transfer
                      credits, and changes to your plan can affect the result.
                    </p>
                  </>
                )}
                {tab === "Your semester" && (
                  <>
                    <h3>Leave a little room for what’s next.</h3>
                    <p>
                      Build an illustrative semester. In the full workspace,
                      your plan connects to your selected program.
                    </p>
                    <div className="sb-semester-list">
                      {semesterCourses.map((c) => (
                        <label key={c}>
                          <input
                            type="checkbox"
                            checked={courses.includes(c)}
                            onChange={(e) =>
                              setCourses(
                                e.target.checked
                                  ? [...courses, c]
                                  : courses.filter((v) => v !== c),
                              )
                            }
                          />
                          <span>{c}</span>
                          <small>3 credits</small>
                        </label>
                      ))}
                    </div>
                    <p className="sb-demo-disclaimer">
                      Sample courses only. This sketch does not check
                      prerequisites or course availability.
                    </p>
                  </>
                )}
              </div>
              <aside className="sb-demo-result" aria-live="polite">
                <span className="sb-tape" />
                <p className="sb-kicker">
                  {tab === "Your grades"
                    ? "THE BIG PICTURE"
                    : tab === "Your next goal"
                      ? "YOUR WHAT-IF RESULT"
                      : "NEXT CHAPTER"}
                </p>
                <strong>
                  {tab === "Your grades"
                    ? stats.cgpa.toFixed(2)
                    : tab === "Your next goal"
                      ? Math.max(0, target.requiredGpa).toFixed(2)
                      : courses.length * 3}
                  <small>
                    {tab === "Your semester" ? "credits" : "/ 4.00"}
                  </small>
                </strong>
                <span>
                  {tab === "Your grades"
                    ? "sample cumulative GPA"
                    : tab === "Your next goal"
                      ? "required future GPA"
                      : "in your sample semester"}
                </span>
                <div className="sb-result-line" />
                <p className="sb-result-hand">
                  {tab === "Your grades"
                    ? "Your story is still being written."
                    : tab === "Your next goal"
                      ? target.requiredGpa > 4
                        ? "Try more credits or a lower target."
                        : target.requiredGpa < 0
                          ? "Your target is within reach even with a 0.00 future average."
                          : "Now your goal has a little direction."
                      : `${courses.length} small steps toward what’s next.`}
                </p>
                <p className="sb-result-detail">
                  {tab === "Your grades"
                    ? `${stats.totalCredits} GPA credits · ${stats.excludedAttempts} excluded attempt`
                    : tab === "Your next goal"
                      ? target.requiredGpa > 4
                        ? "This target needs an average above 4.00 with these credits."
                        : `From ${stats.cgpa.toFixed(2)} to ${goal.toFixed(2)} over ${credits} future credits.`
                      : "A planning sketch, ready to rearrange."}
                </p>
              </aside>
            </div>
            <div className="sb-demo-footer">
              <span>
                <LockKeyhole size={14} /> Just sample data. Your transcript
                stays yours.
              </span>
              <button className="sb-text-link" onClick={onDemo}>
                Explore the full workspace <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </section>
        <section className="sb-how sb-container sb-reveal" id="how-it-works">
          <div className="sb-section-heading">
            <div>
              <p className="sb-kicker">02 / FROM PDF TO PERSPECTIVE</p>
              <h2>
                Three steps.
                <br />
                <em>A clearer next chapter.</em>
              </h2>
            </div>
            <span className="sb-small-stamp">
              YOU’VE
              <br />
              GOT THIS.
            </span>
          </div>
          <div className="sb-step-grid">
            {[
              [
                "01",
                "Bring your story.",
                "Choose a text-based UDST transcript PDF. Courses are extracted right here in your browser.",
                Upload,
                "Import",
              ],
              [
                "02",
                "Check the details.",
                "Review the imported rows. Fix anything uncertain before the numbers become a conclusion.",
                Check,
                "Verify",
              ],
              [
                "03",
                "See what’s possible.",
                "Explore your GPA, degree progress, course patterns, and a plan for the semesters ahead.",
                GraduationCap,
                "Plan",
              ],
            ].map(([n, title, text, Icon, label]) => {
              const StepIcon = Icon as typeof Upload;
              return (
                <article className="sb-step" key={String(n)}>
                  <span className="sb-tape" />
                  <div>
                    <span className="sb-step-number">{String(n)}</span>
                    <StepIcon size={28} />
                  </div>
                  <small>{String(label)}</small>
                  <h3>{String(title)}</h3>
                  <p>{String(text)}</p>
                </article>
              );
            })}
          </div>
        </section>
        <section className="sb-privacy sb-reveal" id="your-privacy">
          <div className="sb-container sb-privacy-grid">
            <div className="sb-privacy-note">
              <span className="sb-tape" />
              <LockKeyhole size={38} />
              <p>
                Personal records.
                <br />
                <em>Personal space.</em>
              </p>
              <span>your transcript belongs to you ♡</span>
            </div>
            <div>
              <p className="sb-kicker">03 / A NOTE ON TRUST</p>
              <h2>
                Some things should
                <br />
                <em>stay in your notebook.</em>
              </h2>
              <p>
                Your transcript is processed on your device. The original PDF is
                never stored, and your academic records aren’t sent to a server.
              </p>
              <ul>
                <li>
                  <ShieldCheck size={18} /> No account to create.
                </li>
                <li>
                  <ShieldCheck size={18} /> Session-only by default; device
                  saving is your choice.
                </li>
                <li>
                  <ShieldCheck size={18} /> Export your work or clear your saved
                  data.
                </li>
              </ul>
            </div>
          </div>
        </section>
        <section className="sb-import sb-container sb-reveal" id="import">
          <div>
            <p className="sb-kicker">04 / THIS ONE’S YOURS</p>
            <h2>
              Turn the page.
              <br />
              <em>Find your next step.</em>
            </h2>
            <p>
              A little less “where do I stand?”
              <br />A little more “here’s where I’m going.”
            </p>
            <span className="sb-import-scribble">
              Start with the PDF. We’ll bring the clarity. ↗
            </span>
          </div>
          <div className="sb-upload-paper">
            <span className="sb-tape" />
            <p className="sb-kicker">YOUR NOTEBOOK STARTS HERE</p>
            <button
              className="sb-upload-target"
              disabled={!!progress}
              onClick={() => file.current?.click()}
            >
              <Upload size={30} />
              <strong>{progress || "Choose your transcript"}</strong>
              <span>Text-based UDST PDF · up to 15 MB · 50 pages</span>
            </button>
            <input
              ref={file}
              className="sr-only"
              type="file"
              accept="application/pdf,.pdf"
              aria-label="Upload UDST transcript"
              onChange={(e) => {
                const selected = e.target.files?.[0];
                if (selected) onFile(selected);
                e.target.value = "";
              }}
            />
            <p className="sb-upload-status" role="status">
              {progress
                ? "Keep this tab open. Your file stays on your device."
                : "Processed locally. Reviewed by you."}
            </p>
            {error && (
              <p className="error-note" role="alert">
                {error}
              </p>
            )}
            <div className="sb-or">
              <span>or, get a feel for it first</span>
            </div>
            <button className="sb-button sb-full-demo" onClick={onDemo}>
              <Sparkles size={16} /> Open the sample workspace{" "}
              <ArrowRight size={16} />
            </button>
          </div>
        </section>
        <section className="sb-faq sb-container sb-reveal">
          <p className="sb-kicker">IN THE MARGINS</p>
          <h2>
            A few good <em>questions.</em>
          </h2>
          {[
            [
              "Is this an official UDST tool?",
              "Transcriptify is an independent student tool, not an official university service. Use your official transcript and academic advisor to confirm decisions.",
            ],
            [
              "Can I use a scanned transcript?",
              "The importer needs a text-based PDF. Image-only scans are not supported. You can correct extracted rows during the review step.",
            ],
            [
              "Will my transcript be saved?",
              "Session-only is the default. You can choose device saving inside the workspace. The original PDF is not stored.",
            ],
            [
              "What can I do after importing?",
              "Review every course, explore GPA trends, select your program plan, model future grades, and export your academic report.",
            ],
          ].map(([q, a]) => (
            <details key={q}>
              <summary>
                {q}
                <ChevronDown size={18} />
              </summary>
              <p>{a}</p>
            </details>
          ))}
        </section>
      </main>
      <footer className="sb-footer sb-container">
        <Brand />
        <span>Every semester is part of your story.</span>
        <a href="#top">Back to the top ↑</a>
        <small>Independent · Made for UDST students</small>
      </footer>
    </div>
  );
}

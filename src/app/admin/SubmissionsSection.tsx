import Image from "next/image";
import { listSubmissionsFromCloudinary } from "@/lib/submissions-admin";
import styles from "./admin.module.css";

export async function SubmissionsSection() {
  const result = await listSubmissionsFromCloudinary();

  if ("error" in result) {
    return (
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <p className={styles.cardTitle}>Public submissions</p>
        </div>
        <div className={styles.cardBody}>
          <p className={styles.muted} style={{ margin: 0 }}>
            Could not load submissions: {result.error}
          </p>
        </div>
      </div>
    );
  }

  const { submissions } = result;

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <p className={styles.cardTitle}>Public submissions</p>
        <span className={styles.pill}>
          {submissions.length.toLocaleString()} recent
        </span>
      </div>
      <div className={styles.cardBody}>
        {submissions.length === 0 ? (
          <p className={styles.muted} style={{ margin: 0 }}>
            No completed submissions in Cloudinary yet (raw index up to ~200 bundle files).
          </p>
        ) : (
          <div className={styles.submissions}>
            {submissions.map((s) => (
              <article key={s.id} className={styles.submissionCard}>
                <header className={styles.submissionHead}>
                  <span className={styles.submissionTitle}>{s.title}</span>
                  <time
                    className={styles.submissionTime}
                    dateTime={s.submittedAt}
                  >
                    {new Date(s.submittedAt).toLocaleString()}
                  </time>
                </header>
                <dl className={styles.submissionDl}>
                  <div>
                    <dt>Email</dt>
                    <dd>
                      <a href={`mailto:${encodeURIComponent(s.email)}`}>
                        {s.email}
                      </a>
                    </dd>
                  </div>
                  {s.phone ? (
                    <div>
                      <dt>Phone</dt>
                      <dd>
                        <a href={`tel:${encodeURIComponent(s.phone)}`}>{s.phone}</a>
                      </dd>
                    </div>
                  ) : null}
                  {s.artist ? (
                    <div>
                      <dt>Artist</dt>
                      <dd>{s.artist}</dd>
                    </div>
                  ) : null}
                  {s.year ? (
                    <div>
                      <dt>Year</dt>
                      <dd>{s.year}</dd>
                    </div>
                  ) : null}
                  {s.category ? (
                    <div>
                      <dt>Category</dt>
                      <dd>{s.category}</dd>
                    </div>
                  ) : null}
                  {s.address ? (
                    <div>
                      <dt>Location</dt>
                      <dd>{s.address}</dd>
                    </div>
                  ) : null}
                  {s.artworkUrl ? (
                    <div>
                      <dt>Link</dt>
                      <dd>
                        <a href={s.artworkUrl} target="_blank" rel="noopener noreferrer">
                          {s.artworkUrl}
                        </a>
                      </dd>
                    </div>
                  ) : null}
                  <div className={styles.submissionDesc}>
                    <dt>Description</dt>
                    <dd>{s.description}</dd>
                  </div>
                </dl>
                <div className={styles.links}>
                  {s.photos.map((p) => (
                    <a
                      key={p.public_id}
                      href={p.secure_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.submissionThumbLink}
                    >
                      <Image
                        src={p.secure_url}
                        alt=""
                        width={72}
                        height={72}
                        className={styles.submissionThumb}
                      />
                    </a>
                  ))}
                </div>
                <p className={styles.submissionId}>
                  Bundle ID <code>{s.id}</code>
                </p>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

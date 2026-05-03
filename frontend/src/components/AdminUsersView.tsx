import { useEffect, useState } from "react";

import { getAdminUsers } from "../api";
import {
  ADMIN_USERS_PAGE_SIZE,
  buildAdminUserPath,
  getAdminSupportFailureMessage,
  getAdminUserListDisplay,
} from "../admin-support";
import type { AdminUserListResponse, AdminUserSummary } from "../types";
import { AdminInviteModal } from "./AdminInviteModal";

interface Props {
  onOpenUser: (userId: string) => void;
}

function SupportPill({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 4,
        minWidth: 92,
      }}
    >
      <span
        style={{
          fontSize: 10,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "var(--text-faint)",
          fontWeight: 600,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 13,
          color: "var(--text-main)",
          fontWeight: 500,
        }}
      >
        {value}
      </span>
    </div>
  );
}

function SupportListState({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <div
      className="glass-panel"
      style={{
        padding: "28px 24px",
        textAlign: "center",
      }}
    >
      <h2
        style={{
          margin: "0 0 12px",
          color: "var(--text-main)",
          fontFamily: "var(--font-serif)",
          fontSize: 30,
          fontWeight: 400,
        }}
      >
        {title}
      </h2>
      <p
        style={{
          margin: 0,
          color: "var(--text-muted)",
          lineHeight: 1.7,
          fontSize: 14,
        }}
      >
        {body}
      </p>
    </div>
  );
}

function SupportUserRow({
  user,
  onOpenUser,
}: {
  user: AdminUserSummary;
  onOpenUser: (userId: string) => void;
}) {
  const detailHref = buildAdminUserPath(user.id);
  const display = getAdminUserListDisplay(user);

  return (
    <a
      href={detailHref}
      onClick={(event) => {
        event.preventDefault();
        onOpenUser(user.id);
      }}
      className="glass-panel"
      style={{
        display: "block",
        padding: "20px 18px",
        textDecoration: "none",
        color: "inherit",
        transition: "transform 0.25s ease, border-color 0.25s ease",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 16,
          marginBottom: 16,
          flexWrap: "wrap",
        }}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              color: "var(--text-main)",
              fontFamily: "var(--font-serif)",
              fontSize: 26,
              fontWeight: 400,
              lineHeight: 1.1,
              marginBottom: 6,
              wordBreak: "break-word",
            }}
          >
            {display.name}
          </div>
          <div
            style={{
              color: "var(--text-muted)",
              fontSize: 14,
              lineHeight: 1.5,
              wordBreak: "break-word",
            }}
          >
            {display.email}
          </div>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 16,
        }}
      >
        <SupportPill label="Plan" value={display.plan} />
        <SupportPill label="Estado" value={display.status} />
      </div>

      {display.supportHint ? (
        <div
          style={{
            marginTop: 14,
            color: "var(--text-muted)",
            fontSize: 13,
            lineHeight: 1.5,
          }}
        >
          {display.supportHint}
        </div>
      ) : null}
    </a>
  );
}

export function AdminUsersView({ onOpenUser }: Props) {
  const [result, setResult] = useState<AdminUserListResponse | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const loadUsers = async () => {
      if (!cancelled) {
        setLoading(true);
      }

      try {
        const response = await getAdminUsers({
          query: search,
          page,
          pageSize: ADMIN_USERS_PAGE_SIZE,
        });

        if (!cancelled) {
          if (response.currentPage !== page) {
            setPage(response.currentPage);
          }
          setResult(response);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            getAdminSupportFailureMessage(
              err,
              "No pudimos abrir soporte en este momento. Reintentá en unos segundos.",
            ),
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadUsers();

    return () => {
      cancelled = true;
    };
  }, [page, search, refreshTick]);

  const users = result?.users ?? [];
  const currentPage = result?.currentPage ?? 1;
  const totalPages = result?.totalPages ?? 1;
  const totalItems = result?.totalItems ?? 0;
  const rangeStart = result?.rangeStart ?? 0;
  const rangeEnd = result?.rangeEnd ?? 0;

  return (
    <div
      style={{
        flex: 1,
        overflow: "auto",
        padding: "28px 24px 40px",
      }}
    >
      <div
        style={{
          maxWidth: 980,
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: 20,
        }}
      >
        <div
          className="glass-panel"
          style={{
            padding: "24px 24px 20px",
          }}
        >
          <div
            style={{
              display: "flex",
              marginBottom: 18,
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div>
              <div
                style={{
                  color: "var(--color-primary)",
                  fontSize: 11,
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  fontWeight: 600,
                  marginBottom: 8,
                }}
              >
                Support Panel
              </div>
              <h1
                style={{
                  margin: 0,
                  color: "var(--text-main)",
                  fontFamily: "var(--font-serif)",
                  fontSize: 36,
                  fontWeight: 400,
                  lineHeight: 1,
                }}
              >
                Personas
              </h1>
            </div>
            <button
              type="button"
              onClick={() => setInviteOpen(true)}
              className="btn-primary"
            >
              Invitar usuaria
            </button>
          </div>
          <p
            style={{
              margin: "0 0 18px",
              color: "var(--text-muted)",
              lineHeight: 1.7,
              fontSize: 14,
              maxWidth: 680,
            }}
          >
            Encontrá rápido quién es cada persona, cómo contactarla y si necesita
            alguna acción.
          </p>
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Buscar por nombre o email"
            aria-label="Buscar personas"
            style={{
              width: "100%",
              borderRadius: 14,
              border: "1px solid rgba(248, 244, 232, 0.12)",
              background: "rgba(248, 244, 232, 0.04)",
              color: "var(--text-main)",
              padding: "14px 16px",
              outline: "none",
              fontSize: 14,
            }}
          />
        </div>

        {loading ? (
          <SupportListState
            title="Cargando usuarios"
            body="Resolviendo la base actual de Astral para mostrar el estado más reciente."
          />
        ) : null}

        {!loading && error ? (
          <SupportListState
            title="No se pudo abrir soporte"
            body={error}
          />
        ) : null}

        {!loading && !error && totalItems === 0 ? (
          <SupportListState
            title="Sin coincidencias"
            body="Probá con otro nombre o email."
          />
        ) : null}

        {!loading && !error && totalItems > 0 ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
                flexWrap: "wrap",
                padding: "0 2px",
              }}
            >
              <div
                style={{
                  color: "var(--text-muted)",
                  fontSize: 13,
                  lineHeight: 1.5,
                }}
              >
                Mostrando {rangeStart}-{rangeEnd} de {totalItems} personas
              </div>

              {totalPages > 1 ? (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    flexWrap: "wrap",
                  }}
                >
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setPage((currentPage) => currentPage - 1)}
                    disabled={currentPage === 1}
                    style={{
                      minWidth: 104,
                    }}
                  >
                    Anterior
                  </button>
                  <div
                    style={{
                      color: "var(--text-main)",
                      fontSize: 13,
                      lineHeight: 1.5,
                    }}
                  >
                    Página {currentPage} de {totalPages}
                  </div>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setPage((currentPage) => currentPage + 1)}
                    disabled={currentPage === totalPages}
                    style={{
                      minWidth: 104,
                    }}
                  >
                    Siguiente
                  </button>
                </div>
              ) : null}
            </div>

            {users.map((user) => (
              <SupportUserRow
                key={user.id}
                user={user}
                onOpenUser={onOpenUser}
              />
            ))}
          </div>
        ) : null}
      </div>
      <AdminInviteModal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        onInvited={() => setRefreshTick((tick) => tick + 1)}
        onOpenUserDetail={onOpenUser}
      />
    </div>
  );
}

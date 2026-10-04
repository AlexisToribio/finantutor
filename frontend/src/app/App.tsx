import { useLocation } from "react-router-dom";

import { BooksPanel } from "../features/books/BooksPanel";
import { ChatPanel } from "../features/chat/ChatPanel";
import { useAuth } from "../shared/auth/AuthProvider";
import { useSessionId } from "../shared/session/useSessionId";
import { CuadernoShell } from "./layout/CuadernoShell";
import { TabNav } from "./layout/TabNav";

export default function App() {
  const { userId, email, signOut } = useAuth();
  const { sessionId, startNewConversation } = useSessionId(userId ?? "");
  const location = useLocation();
  const tab = location.pathname.startsWith("/materiales") ? "materiales" : "tutor";

  return (
    <CuadernoShell
      actions={
        <div className="session-user">
          {email ? <span className="session-chip">{email}</span> : null}
          <button type="button" className="ghost" onClick={() => void signOut()}>
            Salir
          </button>
        </div>
      }
    >
      <TabNav />
      <div hidden={tab !== "tutor"}>
        {userId ? (
          <ChatPanel
            key={sessionId}
            sessionId={sessionId}
            onNewConversation={startNewConversation}
          />
        ) : null}
      </div>
      <div hidden={tab !== "materiales"}>
        <BooksPanel />
      </div>
    </CuadernoShell>
  );
}

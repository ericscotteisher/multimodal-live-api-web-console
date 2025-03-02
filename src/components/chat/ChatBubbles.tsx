import { memo } from "react";
import { useLiveAPIContext } from "../../contexts/LiveAPIContext";
import "./chat-bubbles.scss";

export const ChatBubbles = memo(() => {
  const { textResponses, userMessages } = useLiveAPIContext();

  return (
    <div className="chat-container">
      <div className="messages">
        {/* Interleave user messages and responses */}
        {[...Array(Math.max(userMessages.length, textResponses.length))].map((_, i) => (
          <div key={i} className="message-group">
            {userMessages[i] && (
              <div className="message user">
                <div className="bubble">{userMessages[i]}</div>
              </div>
            )}
            {textResponses[i] && (
              <div className="message ai">
                <div className="bubble">{textResponses[i]}</div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}); 
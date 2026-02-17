import { useState } from 'react'

export const useUiSlice = () => {
  const [feedbackSubject, setFeedbackSubject] = useState('')
  const [feedbackContactEmail, setFeedbackContactEmail] = useState('')
  const [feedbackMessage, setFeedbackMessage] = useState('')
  const [isFeedbackSubmitting, setIsFeedbackSubmitting] = useState(false)
  const [feedbackSubmitMessage, setFeedbackSubmitMessage] = useState<string | null>(null)
  const [feedbackSubmitError, setFeedbackSubmitError] = useState<string | null>(null)

  return {
    feedbackSubject,
    setFeedbackSubject,
    feedbackContactEmail,
    setFeedbackContactEmail,
    feedbackMessage,
    setFeedbackMessage,
    isFeedbackSubmitting,
    setIsFeedbackSubmitting,
    feedbackSubmitMessage,
    setFeedbackSubmitMessage,
    feedbackSubmitError,
    setFeedbackSubmitError,
  }
}

"""Custom exceptions for the Workflow Engine."""

class WorkflowException(Exception):
    """Base exception for all workflow engine issues."""
    pass

class InvalidTransitionException(WorkflowException):
    """Raised when an invalid state transition is requested."""
    pass

class RuleEvaluationException(WorkflowException):
    """Raised when rules cannot be parsed or evaluated."""
    pass

class ApprovalException(WorkflowException):
    """Raised when approval routing or actions fail validation."""
    pass

class SLAException(WorkflowException):
    """Raised when SLA monitoring encounters an error."""
    pass

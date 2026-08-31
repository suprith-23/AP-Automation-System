import os
import psutil

def get_process_memory_mb() -> float:
    """Returns the RSS memory usage of the current process in MB."""
    process = psutil.Process(os.getpid())
    return process.memory_info().rss / (1024 * 1024)
